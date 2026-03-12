import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';
import connectDB from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import { DocumentUpload } from '@/models/Internal';
import Users from '@/models/Users';
import { buildVisibilityQuery } from '@/lib/document-visibility';

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || user.role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        // Admin sees all documents (buildVisibilityQuery returns {} for ADMIN role)
        const visibilityQuery = buildVisibilityQuery(ROLES.ADMIN);

        // Fetch all invoices with file URLs
        const invoices = await Invoice.find({ fileUrl: { $exists: true, $ne: null } })
            .select('id vendorName originalName fileUrl submittedByUserId status created_at receivedAt')
            .sort({ created_at: -1 })
            .lean();

        // Fetch all document uploads
        const documents = await DocumentUpload.find({})
            .select('id fileName fileUrl type uploadedBy status created_at metadata')
            .sort({ created_at: -1 })
            .lean();

        // Get unique user IDs for lookup
        const userIds = new Set([
            ...invoices.map(inv => inv.submittedByUserId).filter(Boolean),
            ...documents.map(doc => doc.uploadedBy).filter(Boolean)
        ]);

        // Fetch user details
        const users = await Users.find({ id: { $in: Array.from(userIds) } })
            .select('id name email role')
            .lean();

        const userMap = users.reduce((acc, u) => {
            acc[u.id] = u;
            return acc;
        }, {});

        // Transform invoices to document format
        const invoiceDocs = invoices.map(inv => ({
            id: inv.id,
            fileName: inv.originalName || `Invoice-${inv.id}`,
            fileUrl: inv.fileUrl,
            type: 'INVOICE',
            uploadedBy: userMap[inv.submittedByUserId] || { name: inv.vendorName || 'Unknown' },
            status: inv.status,
            createdAt: inv.receivedAt || inv.created_at,
            source: 'invoice'
        }));

        // Transform document uploads
        const uploadDocs = documents.map(doc => ({
            id: doc.id,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
            type: doc.type,
            uploadedBy: userMap[doc.uploadedBy] || { name: 'Unknown' },
            status: doc.status,
            createdAt: doc.created_at,
            metadata: doc.metadata,
            source: 'document'
        }));

        // Combine and sort by date
        const allDocuments = [...invoiceDocs, ...uploadDocs].sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        return NextResponse.json({
            documents: allDocuments,
            total: allDocuments.length
        });
    } catch (error) {
        console.error('Admin documents API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
