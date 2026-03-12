import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';

export const dynamic = 'force-dynamic';

function canUserSeeInvoice(user, invoice) {
    if (!user || !invoice) return false;
    if (user.role === ROLES.ADMIN) return true;
    if (user.role === ROLES.FINANCE_USER) return true;
    if (user.role === ROLES.PROJECT_MANAGER) {
        return (user.assignedProjects || []).includes(invoice.project);
    }
    if (user.role === ROLES.VENDOR) {
        return invoice.submittedByUserId === user.id || (invoice.vendorName && (user.name || '').trim() === (invoice.vendorName || '').trim());
    }
    return false;
}

export async function GET(request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const relatedEntityId = url.searchParams.get('relatedEntityId');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

        if (relatedEntityId) {
            const invoice = await db.getInvoice(relatedEntityId);
            if (!invoice) {
                return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
            }
            if (!canUserSeeInvoice(user, invoice)) {
                return NextResponse.json({ error: 'Access denied to this invoice' }, { status: 403 });
            }
        } else {
            // List all notifications: only Admin can see global list
            if (user.role !== ROLES.ADMIN) {
                return NextResponse.json({ error: 'relatedEntityId is required for your role' }, { status: 400 });
            }
        }

        const notifications = await db.getNotifications({
            relatedEntityId: relatedEntityId || null,
            limit
        });

        return NextResponse.json(notifications, {
            headers: { 'Cache-Control': 'no-store, max-age=0' }
        });
    } catch (error) {
        console.error('Notifications fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }
}
