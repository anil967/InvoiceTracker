import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { DocumentUpload } from '@/models/Internal';
import { getSession } from '@/lib/auth';
import { requireRole, getNormalizedRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { validateFileType } from '@/lib/services/ocr';
import { buildVisibilityQuery } from '@/lib/document-visibility';

/**
 * GET /api/dept-head/documents - List documents uploaded by department head team
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const userRole = getNormalizedRole(session.user);
        const invoiceId = searchParams.get('invoiceId');
        const uploadedBy = searchParams.get('uploadedBy');
        const uploadedByRole = searchParams.get('uploadedByRole'); // Filter by uploader role

        // Build visibility query based on role hierarchy
        let query = buildVisibilityQuery(userRole);

        // Admin can filter by specific uploader if provided
        if (uploadedBy && userRole === ROLES.ADMIN) {
            query.uploadedBy = uploadedBy;
        }

        // Allow filtering by uploader role (e.g. div-head fetching only dept-head docs)
        if (uploadedByRole) {
            query.uploadedByRole = uploadedByRole;
        }

        if (invoiceId) query.invoiceId = invoiceId;

        const documents = await DocumentUpload.find(query).sort({ created_at: -1 });

        return NextResponse.json({ documents: documents.map(d => d.toObject()) });
    } catch (error) {
        console.error('Error fetching dept-head documents:', error);
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }
}

/**
 * POST /api/dept-head/documents - Upload document (Department Head team)
 */
export async function POST(request) {
    let type = 'UNKNOWN';
    let file = null;

    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN, ROLES.DEPARTMENT_HEAD])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        const formData = await request.formData();
        file = formData.get('file');
        type = formData.get('type');
        const invoiceId = formData.get('invoiceId') || null;
        const description = formData.get('description');

        if (!file || !type) {
            return NextResponse.json({ error: 'Missing required fields: file, type' }, { status: 400 });
        }

        const validTypes = ['RINGI', 'ANNEX', 'TIMESHEET', 'RATE_CARD', 'INVOICE', 'RFP_COMMERCIAL', 'OTHER'];
        if (!validTypes.includes(type)) {
            return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
        }

        const fileTypeValidation = validateFileType(file.name, type);
        if (!fileTypeValidation.valid) {
            return NextResponse.json({ error: fileTypeValidation.error }, { status: 400 });
        }

        await connectToDatabase();

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64String = buffer.toString('base64');
        const mimeType = file.type || 'application/octet-stream';
        const fileUrl = `data:${mimeType};base64,${base64String}`;
        const fileId = uuidv4();
        const userRole = getNormalizedRole(session.user);

        const document = await DocumentUpload.create({
            id: fileId,
            invoiceId: invoiceId || null,
            type,
            fileName: file.name,
            fileUrl,
            mimeType,
            fileSize: buffer.length,
            uploadedBy: session.user.id,
            uploadedByRole: userRole,
            metadata: {
                description: description || null,
            },
            status: 'PENDING'
        });

        await db.createAuditTrailEntry({
            invoice_id: invoiceId,
            username: session.user.name || session.user.email,
            action: 'DOCUMENT_UPLOADED',
            details: `Dept Head uploaded ${type}: ${file.name}`
        });

        return NextResponse.json({ success: true, document: document.toObject() }, { status: 201 });
    } catch (error) {
        console.error('Error uploading dept-head document:', error);
        return NextResponse.json({ error: 'Failed to upload document', details: error.message }, { status: 500 });
    }
}
