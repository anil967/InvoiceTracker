import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';

export const dynamic = 'force-dynamic';

function canUserSeeInvoice(user, invoice) {
    if (!user || !invoice) return false;
    if (user.role === ROLES.ADMIN) return true;
    if (user.role === ROLES.FINANCE_USER) return true;
    if (user.role === ROLES.PROJECT_MANAGER) return (user.assignedProjects || []).includes(invoice.project);
    if (user.role === ROLES.VENDOR) return invoice.submittedByUserId === user.id;
    return false;
}

export async function GET(request) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const invoiceId = url.searchParams.get('invoiceId');
        const limit = parseInt(url.searchParams.get('limit') || '100');

        if (invoiceId) {
            // Single-invoice: allow if user can see this invoice
            const invoice = await db.getInvoice(invoiceId);
            if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
            if (!canUserSeeInvoice(currentUser, invoice)) {
                return NextResponse.json({ error: 'Access denied to this invoice.' }, { status: 403 });
            }
            const logs = await db.getAuditTrail(invoiceId);
            return NextResponse.json(logs);
        }

        // Global audit list: Admin only
        if (currentUser.role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Access denied. Audit logs are restricted to Admin only.' }, { status: 403 });
        }

        const logs = await db.getAllAuditLogs(limit);
        return NextResponse.json(logs);
    } catch (error) {
        console.error('Audit log fetch error:', error);
        return NextResponse.json({ error: 'Failed to retrieve audit logs' }, { status: 500 });
    }
}
