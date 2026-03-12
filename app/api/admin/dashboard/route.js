import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

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

        // Verify user has Admin role using helper
        const { getNormalizedRole: normalize } = await import('@/constants/roles');
        const role = normalize(user);

        if (role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Fetch invoices with RBAC filtering (Admin sees all invoices)
        const invoices = await db.getInvoices(user);

        // Calculate admin-specific statistics
        const stats = {
            totalVolume: invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0),
            discrepancyCount: invoices.filter(inv => inv.status === 'MATCH_DISCREPANCY').length,
            verifiedCount: invoices.filter(inv => inv.status === 'VERIFIED').length,
            pendingApprovalCount: invoices.filter(inv => inv.status === 'PENDING_APPROVAL').length,
            totalInvoices: invoices.length
        };

        // Return stats and filtered invoices
        return NextResponse.json({
            stats,
            invoices
        });

    } catch (error) {
        console.error('Admin dashboard API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
