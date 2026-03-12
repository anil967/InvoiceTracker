import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import Users from '@/models/Users';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/hierarchy-check
 * Debug endpoint: checks a PM's managedBy, the resulting FU,
 * and the assignedFinanceUser on recent invoices.
 * Admin-only.
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const pmId = searchParams.get('pmId');  // optional: specific PM to check

        // 1. Get all PMs and their managedBy
        const allPMs = await Users.find({ role: { $in: ['PM', 'Project Manager', 'project manager'] } })
            .lean()
            .select('id name role managedBy email');

        const pmResults = await Promise.all(allPMs.map(async (pm) => {
            let manager = null;
            if (pm.managedBy) {
                manager = await Users.findOne({ id: pm.managedBy }).lean().select('id name role');
            }
            return {
                pm_id: pm.id,
                pm_name: pm.name,
                pm_role: pm.role,
                pm_email: pm.email,
                managedBy_id: pm.managedBy || null,
                managedBy_name: manager?.name || null,
                managedBy_role: manager?.role || null,
                hierarchy_valid: !!manager && (manager.role === 'Finance User' || manager.role === 'finance user')
            };
        }));

        // 2. Get 10 most recent invoices and their assignedFinanceUser
        const recentInvoices = await Invoice.find({})
            .sort({ created_at: -1 })
            .limit(10)
            .lean()
            .select('id invoiceNumber assignedPM assignedFinanceUser status created_at vendorName');

        const invoiceDetails = await Promise.all(recentInvoices.map(async (inv) => {
            let fuName = null;
            let pmName = null;
            if (inv.assignedFinanceUser) {
                const fu = await Users.findOne({ id: inv.assignedFinanceUser }).lean().select('name role');
                fuName = fu ? `${fu.name} (${fu.role})` : 'NOT FOUND in DB';
            }
            if (inv.assignedPM) {
                const pm = await Users.findOne({ id: inv.assignedPM }).lean().select('name managedBy');
                pmName = pm?.name || 'NOT FOUND';
            }
            return {
                invoice_id: inv.id,
                invoice_number: inv.invoiceNumber,
                vendor_name: inv.vendorName,
                status: inv.status,
                created_at: inv.created_at,
                assigned_pm_id: inv.assignedPM || null,
                assigned_pm_name: pmName,
                assigned_finance_user_id: inv.assignedFinanceUser || null,
                assigned_finance_user_name: fuName,
                issue: !inv.assignedFinanceUser ? '⚠️ assignedFinanceUser is NULL — will not appear for any FU' : '✅ OK'
            };
        }));

        // 3. Get all Finance Users for reference
        const allFUs = await Users.find({ role: { $in: ['Finance User', 'finance user', 'Finance_User'] } })
            .lean()
            .select('id name role email');

        return NextResponse.json({
            message: 'Hierarchy Debug Report',
            finance_users: allFUs.map(fu => ({ id: fu.id, name: fu.name, role: fu.role, email: fu.email })),
            pms_and_hierarchy: pmResults,
            recent_invoices: invoiceDetails
        }, { status: 200 });

    } catch (error) {
        console.error('Hierarchy check error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
