import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { DocumentUpload } from '@/models/Internal';
import Users from '@/models/Users';
import { getSession } from '@/lib/auth';
import { requireRole, checkPermission, getNormalizedRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { validateFileType } from '@/lib/services/ocr';
import { validateTimesheet, validateRateCard } from '@/lib/services/validation';
import { buildVisibilityQuery } from '@/lib/document-visibility';

/**
 * GET /api/pm/documents - List PM's uploaded documents
 */
/**
 * Get all project IDs that a PM can access (assigned + delegated)
 */
async function getAccessibleProjectIds(userId) {
    try {
        // Get the user's assigned projects
        const user = await Users.findOne({ id: userId });
        const assignedProjectIds = user?.assignedProjects || [];

        // Check for projects delegated TO this user
        const delegators = await Users.find({
            delegatedTo: userId,
            delegationExpiresAt: { $gt: new Date() }
        });
        const delegatedProjectIds = delegators.flatMap(u => u.assignedProjects || []);

        // Return unique project IDs
        return [...new Set([...assignedProjectIds, ...delegatedProjectIds])];
    } catch (error) {
        console.error('Failed to get accessible project IDs:', error);
        return [];
    }
}

/**
 * GET /api/pm/documents - List PM's uploaded documents
 * Also accessible by Admin and Finance users
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.FINANCE_USER, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const userRole = getNormalizedRole(session.user);
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const invoiceId = searchParams.get('invoiceId'); // Filter by specific invoice
        const uploadedBy = searchParams.get('uploadedBy'); // Filter by uploader ID (Admin only)
        const uploadedByRole = searchParams.get('uploadedByRole'); // Filter by uploader role
        const type = searchParams.get('type');
        const status = searchParams.get('status');

        // Build visibility query based on role hierarchy
        let query = buildVisibilityQuery(userRole);

        // Admin can filter by specific uploader if provided
        if (uploadedBy && userRole === ROLES.ADMIN) {
            query.uploadedBy = uploadedBy;
        }

        // Allow filtering by uploader role (e.g. dept-head fetching only PM docs)
        if (uploadedByRole) {
            query.uploadedByRole = uploadedByRole;
        }

        if (invoiceId) query.invoiceId = invoiceId;
        // Support 'non-invoice' as a special filter to exclude the primary INVOICE type
        if (type && type !== 'non-invoice') query.type = type;
        if (type === 'non-invoice') query.type = { $ne: 'INVOICE' };
        if (status) query.status = status;

        const documents = await DocumentUpload.find(query).sort({ created_at: -1 });

        return NextResponse.json({ documents: documents.map(d => d.toObject()) });
    } catch (error) {
        console.error('Error fetching documents:', error);
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }
}

/**
 * POST /api/pm/documents - Upload document (Ringi, Annex, Timesheet, Rate Card)
 * Enhanced with comprehensive validation for timesheets and rate cards
 */
export async function POST(request) {
    let type = 'UNKNOWN';
    let projectId = 'UNKNOWN';
    let file = null;

    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        if (!checkPermission(session.user, 'UPLOAD_DOCUMENT')) {
            return NextResponse.json({ error: 'Not authorized to upload documents' }, { status: 403 });
        }

        const formData = await request.formData();
        file = formData.get('file');
        type = formData.get('type');
        projectId = formData.get('projectId');
        const invoiceId = formData.get('invoiceId');
        const billingMonth = formData.get('billingMonth');
        const ringiNumber = formData.get('ringiNumber');
        const projectName = formData.get('projectName');
        const vendorId = formData.get('vendorId');
        const description = formData.get('description');

        // Verify projectId ownership removed since projects are disabled
        const role = getNormalizedRole(session.user);

        if (!file || !type) {
            return NextResponse.json(
                { error: 'Missing required fields: file, type' },
                { status: 400 }
            );
        }

        // Validate document type
        const validTypes = ['RINGI', 'ANNEX', 'TIMESHEET', 'RATE_CARD', 'INVOICE'];
        if (type === 'RFP_COMMERCIAL') type = 'ANNEX'; // Compatibility

        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
                { status: 400 }
            );
        }

        // Validate file type for document type
        const fileTypeValidation = validateFileType(file.name, type);
        if (!fileTypeValidation.valid) {
            return NextResponse.json(
                { error: fileTypeValidation.error },
                { status: 400 }
            );
        }

        await connectToDatabase();

        // Read file buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Store as Base64 for Vercel compatibility
        const base64String = buffer.toString('base64');
        const mimeType = file.type || 'application/octet-stream';
        const fileUrl = `data:${mimeType};base64,${base64String}`;

        const fileId = uuidv4();

        // Initialize validation results
        let validated = false;
        let validationNotes = '';
        let validationData = null;
        let validationErrors = [];
        let validationWarnings = [];

        // Perform type-specific validation
        if (type === 'TIMESHEET') {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (['xls', 'xlsx'].includes(ext)) {
                const validation = await validateTimesheet(buffer, { vendorId, projectId });
                validated = validation.isValid;
                validationErrors = validation.errors || [];
                validationWarnings = validation.warnings || [];
                validationData = validation.data;
                validationNotes = validated
                    ? `Validated: ${validation.data?.summary?.totalHours || 0} hours across ${validation.data?.summary?.totalEntries || 0} entries`
                    : `Validation failed: ${validationErrors.slice(0, 3).join('; ')}`;
            } else {
                // PDF timesheet - mark as pending manual review
                validated = false;
                validationNotes = 'PDF timesheet requires manual review';
            }
        } else if (type === 'RATE_CARD') {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (['xls', 'xlsx'].includes(ext)) {
                const validation = await validateRateCard(buffer);
                validated = validation.isValid;
                validationErrors = validation.errors || [];
                validationWarnings = validation.warnings || [];
                validationData = validation.data;
                validationNotes = validated
                    ? `Validated: ${validation.data?.summary?.totalRates || 0} rate entries`
                    : `Validation failed: ${validationErrors.slice(0, 3).join('; ')}`;
            } else {
                validated = false;
                validationNotes = 'PDF rate card requires manual review';
            }
        } else if (type === 'RINGI' || type === 'ANNEX' || type === 'RFP_COMMERCIAL') {
            // Basic validation - file exists and has content
            validated = buffer.length > 0;
            validationNotes = validated ? 'Document received' : 'Empty file detected';
        }

        // Create document record
        const document = await DocumentUpload.create({
            id: fileId,
            projectId: projectId || null,
            invoiceId: invoiceId || null,
            type,
            fileName: file.name,
            fileUrl: fileUrl,
            mimeType: mimeType,
            fileSize: buffer.length,
            uploadedBy: session.user.id,
            uploadedByRole: role,
            metadata: {
                billingMonth: billingMonth || null,
                validated,
                validationNotes,
                ringiNumber: ringiNumber || null,
                projectName: projectName || null,
                description: description || null,
                validationData: validationData || null
            },
            status: validated ? 'VALIDATED' : 'PENDING'
        });

        // Audit trail
        await db.createAuditTrailEntry({
            invoice_id: invoiceId || null,
            username: session.user.name || session.user.email,
            action: 'DOCUMENT_UPLOADED',
            details: `Uploaded ${type}: ${file.name}${validated ? ' (Validated)' : ' (Pending)'}`
        });

        return NextResponse.json({
            success: true,
            document: document.toObject(),
            validation: {
                isValid: validated,
                errors: validationErrors,
                warnings: validationWarnings,
                notes: validationNotes
            }
        }, { status: 201 });
    } catch (error) {
        console.error('Error uploading document:', {
            message: error.message,
            stack: error.stack,
            type: type,
            projectId: projectId
        });
        return NextResponse.json({
            error: 'Failed to upload document',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}

/**
 * DELETE /api/pm/documents - Delete a document
 */
export async function DELETE(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const documentId = searchParams.get('id');

        if (!documentId) {
            return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
        }

        await connectToDatabase();

        const document = await DocumentUpload.findOne({ id: documentId });
        if (!document) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // Only allow deletion of own documents (unless admin)
        if (session.user.role !== ROLES.ADMIN && document.uploadedBy !== session.user.id) {
            return NextResponse.json({ error: 'Not authorized to delete this document' }, { status: 403 });
        }

        await DocumentUpload.deleteOne({ id: documentId });

        // Audit trail
        await db.createAuditTrailEntry({
            invoice_id: document.invoiceId || null,
            username: session.user.name || session.user.email,
            action: 'DOCUMENT_DELETED',
            details: `Deleted ${document.type}: ${document.fileName}`
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting document:', error);
        return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }
}

