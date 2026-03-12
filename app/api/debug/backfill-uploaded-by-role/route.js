import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getNormalizedRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import connectToDatabase from '@/lib/mongodb';
import { DocumentUpload } from '@/models/Internal';
import Users from '@/models/Users';

export const dynamic = 'force-dynamic';

/**
 * POST /api/debug/backfill-uploaded-by-role
 * One-time backfill: populate the uploadedByRole field for all DocumentUpload records
 * that don't have it set. Admin-only.
 */
export async function POST(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const role = getNormalizedRole(session.user);
        if (role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Admin only' }, { status: 403 });
        }

        await connectToDatabase();

        // Find all documents without uploadedByRole field
        const documentsToFix = await DocumentUpload.find({
            $or: [
                { uploadedByRole: null },
                { uploadedByRole: { $exists: false } },
                { uploadedByRole: '' }
            ]
        }).lean().select('id uploadedBy fileName type uploadedByRole');

        console.log(`[Backfill] Found ${documentsToFix.length} documents to fix`);

        if (documentsToFix.length === 0) {
            return NextResponse.json({
                message: 'All documents already have uploadedByRole field',
                patched_count: 0,
                skipped_count: 0,
                details: []
            }, { status: 200 });
        }

        // Build a cache of userId → role to minimize DB lookups
        const userRoleCache = {};
        const results = [];

        for (const doc of documentsToFix) {
            if (!doc.uploadedBy) {
                results.push({
                    document_id: doc.id,
                    file_name: doc.fileName,
                    status: '⚠️ skipped — no uploadedBy user ID',
                    assigned_role: null
                });
                continue;
            }

            // Use cache
            if (!(doc.uploadedBy in userRoleCache)) {
                const user = await Users.findOne({ id: doc.uploadedBy }).lean().select('id name role');
                if (user) {
                    userRoleCache[doc.uploadedBy] = getNormalizedRole(user);
                } else {
                    userRoleCache[doc.uploadedBy] = null;
                }
            }

            const userRole = userRoleCache[doc.uploadedBy];

            if (userRole) {
                // Patch the document
                await DocumentUpload.findOneAndUpdate(
                    { id: doc.id },
                    { $set: { uploadedByRole: userRole } }
                );
                results.push({
                    document_id: doc.id,
                    file_name: doc.fileName,
                    document_type: doc.type,
                    status: '✅ patched',
                    assigned_role: userRole
                });
            } else {
                results.push({
                    document_id: doc.id,
                    file_name: doc.fileName,
                    document_type: doc.type,
                    status: '⚠️ skipped — user not found',
                    assigned_role: null
                });
            }
        }

        const patched = results.filter(r => r.status.startsWith('✅')).length;
        const skipped = results.filter(r => r.status.startsWith('⚠️')).length;

        return NextResponse.json({
            message: `Backfill complete. ${patched} patched, ${skipped} skipped.`,
            patched_count: patched,
            skipped_count: skipped,
            details: results
        }, { status: 200 });

    } catch (error) {
        console.error('Backfill error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
