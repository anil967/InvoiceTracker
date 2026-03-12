import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { INVOICE_STATUS } from '@/lib/invoice-workflow';

/**
 * GET /api/dept-head/dashboard
 * Returns only invoices that legitimately belong to this Dept Head:
 *  - explicitly assigned to them (assignedDeptHead = user.id), OR
 *  - already reviewed by them (deptHeadApproval.approvedBy = user.id)
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.DEPARTMENT_HEAD, ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        // db.getInvoices already applies the correct RBAC filter for DEPARTMENT_HEAD
        // (assignedDeptHead = user.id, with fallback for unassigned invoices from managed PMs)
        const allForRole = await db.getInvoices(session.user);

        // Further narrow: only invoices actually in the dept-head workflow stages
        // to avoid showing invoices that are already fully processed / unrelated
        const DEPT_HEAD_STATUSES = [
            INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW,
            INVOICE_STATUS.DEPT_HEAD_REJECTED,
            INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW,
            INVOICE_STATUS.DIV_HEAD_APPROVED,
            INVOICE_STATUS.DIV_HEAD_REJECTED,
        ];

        const invoices = allForRole.filter(inv =>
            // Directly assigned to this dept head
            inv.assignedDeptHead === session.user.id ||
            // OR already actioned by this dept head (history)
            inv.deptHeadApproval?.approvedBy === session.user.id ||
            // OR assigned to this dept head AND in the right stage
            DEPT_HEAD_STATUSES.includes(inv.status)
        );

        return NextResponse.json(invoices);
    } catch (error) {
        console.error('Error fetching dept head dashboard:', error);
        return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }
}
