import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { INVOICE_STATUS } from '@/lib/invoice-workflow';

/**
 * GET /api/div-head/dashboard
 * Returns only invoices that legitimately belong to this Div Head:
 *  - explicitly assigned to them (assignedDivHead = user.id), OR
 *  - already reviewed by them (divHeadApproval.approvedBy = user.id)
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.DIVISIONAL_HEAD, ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        // db.getInvoices already applies the correct RBAC filter for DIVISIONAL_HEAD
        const allForRole = await db.getInvoices(session.user);

        // Further narrow: only invoices in the div-head workflow stages
        const DIV_HEAD_STATUSES = [
            INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW,
            INVOICE_STATUS.DIV_HEAD_APPROVED,
            INVOICE_STATUS.DIV_HEAD_REJECTED,
        ];

        const invoices = allForRole.filter(inv =>
            // Directly assigned to this div head
            inv.assignedDivHead === session.user.id ||
            // OR already actioned by this div head (history)
            inv.divHeadApproval?.approvedBy === session.user.id ||
            // OR in a div-head stage
            DIV_HEAD_STATUSES.includes(inv.status)
        );

        return NextResponse.json(invoices);
    } catch (error) {
        console.error('Error fetching div head dashboard:', error);
        return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }
}
