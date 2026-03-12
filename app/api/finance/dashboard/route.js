import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server-auth';
import { db } from '@/lib/db';
import { ROLES } from '@/constants/roles';

export async function GET() {
    try {
        // Get current user from session
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verify user has Finance role or is an Admin
        const role = user.role;
        if (role !== ROLES.FINANCE_USER && role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Forbidden: Finance or Admin access required' }, { status: 403 });
        }

        // Fetch invoices with RBAC filtering (Finance sees all invoices)
        const invoices = await db.getInvoices(user);

        // Calculate finance-specific statistics
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const stats = {
            pendingApprovals: invoices.filter(inv =>
                inv.status === 'PENDING_APPROVAL' &&
                !inv.financeApproval?.status
            ).length,
            mtdSpend: invoices
                .filter(inv => inv.created_at && new Date(inv.created_at) >= startOfMonth)
                .reduce((sum, inv) => sum + (inv.amount || 0), 0),
            weeklyProcessedCount: invoices
                .filter(inv => inv.created_at && new Date(inv.created_at) >= startOfLastWeek)
                .length,
            totalInvoices: invoices.length
        };

        // Return stats and filtered invoices
        return NextResponse.json({
            stats,
            invoices
        });

    } catch (error) {
        console.error('Finance dashboard API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
