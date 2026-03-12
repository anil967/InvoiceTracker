import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { processInvoice } from '@/lib/processor';
import { getCurrentUser } from '@/lib/server-auth';
import { sendStatusNotification } from '@/lib/notifications';
import { ROLES, getNormalizedRole } from '@/constants/roles';
import { v4 as uuidv4 } from 'uuid';
import connectToDatabase from '@/lib/mongodb';
import { DocumentUpload } from '@/models/Internal';

// Helper to log to DB for production debugging
const logToDb = async (level, message, details = {}) => {
    try {
        console.log(`[${level}] ${message}`, details); // Consoles for Vercel logs
        // Also save to a debug collection for persistence
        await connectToDatabase();
        if (db && db.createDebugLog) {
            await db.createDebugLog({ level, message, details, timestamp: new Date() });
        } else {
            // Fallback if db helper helper missing, direct insert if possible or just console
            const mongoose = await import('mongoose');
            const DebugLog = mongoose.models.DebugLog || mongoose.model('DebugLog', new mongoose.Schema({
                level: String,
                message: String,
                details: Object,
                timestamp: Date
            }));
            await DebugLog.create({ level, message, details, timestamp: new Date() });
        }
    } catch (e) {
        console.error('Failed to log to DB:', e);
    }
};

export async function POST(request) {
    // No file system logging in Vercel


    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Get the authenticated user to associate invoice with vendor
        const user = await getCurrentUser();
        if (!user) {
            await logToDb('WARN', 'Unauthorized access attempt in /api/ingest');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        await logToDb('INFO', `User submitting invoice`, { userId: user.id, email: user.email, role: user.role });


        // Validate disclaimer acceptance (FR-6: Declaration & Confirmation)
        const disclaimerAccepted = formData.get('disclaimerAccepted');
        if (disclaimerAccepted !== 'true') {
            return NextResponse.json({
                error: 'Declaration & Confirmation must be accepted before submitting an invoice',
                detail: 'Please check the certification checkbox to confirm the invoice data is accurate'
            }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Vercel Fix: Do not write to filesystem (read-only).
        // Convert to Base64 Data URI for immediate access/preview.
        const base64String = buffer.toString('base64');

        // Determine MIME type from file extension if not provided
        let mimeType = file.type;
        if (!mimeType) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            const mimeMap = {
                'pdf': 'application/pdf',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xls': 'application/vnd.ms-excel',
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'csv': 'text/csv',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
            };
            mimeType = mimeMap[ext] || 'application/pdf';
        }

        const fileUrl = `data:${mimeType};base64,${base64String}`;

        const invoiceId = `INV-${uuidv4().slice(0, 8).toUpperCase()}`;
        const receivedAt = new Date().toISOString();

        // Use constants for initial status
        const { INVOICE_STATUS } = await import('@/lib/invoice-workflow');
        const userRole = getNormalizedRole(user);

        const invoiceMetadata = {
            id: invoiceId,
            vendorName: userRole === ROLES.VENDOR ? user.name : 'Pending Identification',
            submittedByUserId: user.id, // So vendor list filters by user.id and updates correctly
            vendorId: userRole === ROLES.VENDOR && user.vendorId ? user.vendorId : undefined, // Uniquely identify which vendor uploaded (admin/PM)
            originalName: file.name,
            fileUrl: fileUrl,
            status: INVOICE_STATUS.SUBMITTED,
            receivedAt,
            auditUsername: user.name || 'Vendor',
            auditAction: 'SUBMIT',
            auditDetails: `Invoice "${file.name}" submitted via vendor portal (${userRole === ROLES.VENDOR ? 'Vendor' : userRole})`,
            // Manual Entry Fields
            assignedPM: formData.get('assignedPM'),
            assignedFinanceUser: formData.get('assignedFinanceUser'),
            invoiceNumber: formData.get('invoiceNumber'), // Manual override
            date: formData.get('date'), // Submission date (auto-set by frontend)
            invoiceDate: formData.get('invoiceDate'), // Invoice date from vendor
            amount: formData.get('amount') ? parseFloat(formData.get('amount')) : undefined, // Manual override
            basicAmount: formData.get('basicAmount') ? parseFloat(formData.get('basicAmount')) : undefined,
            taxType: formData.get('taxType') || undefined,
            hsnCode: formData.get('hsnCode') || undefined,
            currency: 'INR', // Restricted to INR
            // Disclaimer acceptance for audit trail
            disclaimerAccepted: disclaimerAccepted === 'true',
            disclaimerAcceptedAt: new Date().toISOString(),
        };

        // Create initial audit trail entry
        const auditTrailEntry = {
            action: 'submit',
            actor: user.name || user.email || 'System',
            actorId: String(user.id),
            actorRole: userRole,
            timestamp: new Date(),
            previousStatus: null,
            newStatus: INVOICE_STATUS.SUBMITTED,
            notes: `Invoice "${file.name}" submitted via vendor portal`,
            ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown'
        };

        // Persist to DB and create audit trail
        await db.saveInvoice(invoiceId, {
            ...invoiceMetadata,
            auditTrailEntry: auditTrailEntry
        });

        // Handle additional document uploads (RFP, Commercial/Timesheet)
        await connectToDatabase();
        const additionalDocs = [];
        const rfpFile = formData.get('rfpFile');
        const commercialFile = formData.get('timesheetFile');

        const saveAdditionalDoc = async (docFile, docType) => {
            if (!docFile || docFile.size === 0) return null;
            const docBuffer = Buffer.from(await docFile.arrayBuffer());
            const docBase64 = docBuffer.toString('base64');
            const docMime = docFile.type || 'application/octet-stream';
            const docUrl = `data:${docMime};base64,${docBase64}`;
            const docId = uuidv4();

            const document = await DocumentUpload.create({
                id: docId,
                invoiceId: invoiceId,
                type: docType,
                fileName: docFile.name,
                fileUrl: docUrl,
                mimeType: docMime,
                fileSize: docBuffer.length,
                uploadedBy: user.id,
                uploadedByRole: userRole,
                metadata: {
                    validated: docBuffer.length > 0,
                    validationNotes: 'Document received via vendor submission',
                },
                status: docBuffer.length > 0 ? 'VALIDATED' : 'PENDING'
            });

            return { documentId: docId, type: docType };
        };

        const rfpDoc = await saveAdditionalDoc(rfpFile, 'ANNEX');
        const commercialDoc = await saveAdditionalDoc(commercialFile, 'TIMESHEET');

        if (rfpDoc) additionalDocs.push(rfpDoc);
        if (commercialDoc) additionalDocs.push(commercialDoc);

        // Link additional documents to invoice
        if (additionalDocs.length > 0) {
            await db.saveInvoice(invoiceId, { documents: additionalDocs });
        }

        // Perform processing inline (Simulation)
        const result = await processInvoice(invoiceId, buffer);

        if (result.success) {
            // Determine final status based on validation result
            // Advanced automatically to Pending PM Approval if valid, otherwise stays in Submitted or flagged
            const finalStatus = (result.validation.isValid && result.matching?.isMatched)
                ? INVOICE_STATUS.PENDING_PM_APPROVAL
                : INVOICE_STATUS.SUBMITTED;

            await db.saveInvoice(invoiceId, {
                ...result.data,
                // Preserve vendor identity & Project/PM
                submittedByUserId: invoiceMetadata.submittedByUserId,
                vendorName: invoiceMetadata.vendorName,
                vendorId: invoiceMetadata.vendorId,
                assignedPM: invoiceMetadata.assignedPM,

                // Prioritize Manual Entry over IDP (if provided)
                invoiceNumber: invoiceMetadata.invoiceNumber || result.data.invoiceNumber,
                date: invoiceMetadata.date || result.data.date,
                invoiceDate: invoiceMetadata.invoiceDate,
                amount: invoiceMetadata.amount || result.data.amount,
                basicAmount: invoiceMetadata.basicAmount,
                taxType: invoiceMetadata.taxType,
                hsnCode: invoiceMetadata.hsnCode,
                currency: 'INR',

                fileUrl: fileUrl,
                validation: result.validation,
                matching: result.matching,
                status: finalStatus,
                processedAt: new Date().toISOString(),
                digitizedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }

        // Notify vendor that invoice was received
        const savedInvoice = await db.getInvoice(invoiceId);
        if (savedInvoice) {
            await sendStatusNotification(savedInvoice, savedInvoice.status).catch((err) =>
                console.error('[Ingest] Notification failed:', err)
            );
        }

        await logToDb('INFO', `Invoice saved successfully`, { invoiceId, userId: invoiceMetadata.submittedByUserId });

        return NextResponse.json({
            message: 'Invoice received and processing started',
            invoice: await db.getInvoice(invoiceId)
        });


    } catch (error) {
        console.error('Ingestion error:', error);
        await logToDb('ERROR', `Ingestion failed: ${error.message}`, { stack: error.stack });

        return NextResponse.json({ error: 'Failed to process invoice ingestion' }, { status: 500 });
    }
}
