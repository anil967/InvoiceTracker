import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getNormalizedRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import connectToDatabase from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import Users from '@/models/Users';

export const dynamic = 'force-dynamic';

/**
 * POST /api/debug/backfill-finance-user
 * One-time backfill: for every invoice with assignedPM but null assignedFinanceUser,
 * look up the PM's managedBy and set the correct Finance User.
 * Admin-only.
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

        // Find all invoices that have a PM assigned but no Finance User
        const invoicesToFix = await Invoice.find({
            assignedPM: { $nin: [null, ''] },
            $or: [
                { assignedFinanceUser: null },
                { assignedFinanceUser: { $exists: false } },
                { assignedFinanceUser: '' }
            ]
        }).lean().select('id invoiceNumber assignedPM assignedFinanceUser');

        console.log(`[Backfill] Found ${invoicesToFix.length} invoices to fix`);

        // Build a cache of PM → FU to minimize DB lookups
        const pmFuCache = {};
        const results = [];

        for (const inv of invoicesToFix) {
            if (!inv.assignedPM) continue;

            // Use cache
            if (!(inv.assignedPM in pmFuCache)) {
                const pm = await Users.findOne({ id: inv.assignedPM }).lean().select('id name managedBy');
                if (pm?.managedBy) {
                    const manager = await Users.findOne({ id: pm.managedBy }).lean().select('id name role');
                    const managerRole = manager ? getNormalizedRole(manager) : null;
                    pmFuCache[inv.assignedPM] = (managerRole === ROLES.FINANCE_USER) ? manager : null;
                } else {
                    pmFuCache[inv.assignedPM] = null;
                }
            }

            const fuUser = pmFuCache[inv.assignedPM];

            if (fuUser) {
                // Patch the invoice
                await Invoice.findOneAndUpdate(
                    { id: inv.id },
                    { $set: { assignedFinanceUser: fuUser.id } }
                );
                results.push({
                    invoice_id: inv.id,
                    invoice_number: inv.invoiceNumber || inv.id,
                    status: '✅ patched',
                    assigned_fu: fuUser.name,
                    fu_id: fuUser.id
                });
            } else {
                results.push({
                    invoice_id: inv.id,
                    invoice_number: inv.invoiceNumber || inv.id,
                    status: '⚠️ skipped — PM has no Finance User in hierarchy',
                    assigned_fu: null,
                    fu_id: null
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
