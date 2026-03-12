import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server-auth';
import connectToDatabase from '@/lib/mongodb';
import { DocumentUpload } from '@/models/Internal';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invoices/[id]/documents
 * Returns all DocumentUpload records for a given invoice.
 * Accessible by PM, Finance, Dept Head, Div Head, Admin.
 */
export async function GET(request, { params }) {
    try {
        const { id: invoiceId } = await params;
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();

        const docs = await DocumentUpload.find({ invoiceId })
            .select('id invoiceId type fileName mimeType fileSize uploadedBy uploadedByRole uploadedAt')
            .lean();

        return NextResponse.json({
            documents: docs.map(d => ({
                documentId: d.id,
                type: d.type,
                fileName: d.fileName,
                mimeType: d.mimeType,
                uploadedByRole: d.uploadedByRole,
                uploadedAt: d.uploadedAt || d.createdAt,
            }))
        });
    } catch (error) {
        console.error('[API] Invoice documents fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }
}
