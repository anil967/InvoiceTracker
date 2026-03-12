import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { sendStatusNotification } from '@/lib/notifications';
import { ROLES } from '@/constants/roles';

/**
 * POST /api/admin/approve/:id - Final system approval (Admin only)
 */
export async function POST(request, { params }) {
    try {
        // Capture request metadata for audit trail early
        const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { action, notes } = body;

        if (!action || !['APPROVE', 'REJECT'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Must be APPROVE or REJECT' },
                { status: 400 }
            );
        }

        const invoice = await db.getInvoice(id);
        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        // Check if PM approval is complete
        if (invoice.pmApproval?.status !== 'APPROVED') {
            return NextResponse.json(
                { error: 'PM approval required before final admin approval' },
                { status: 400 }
            );
        }

        // Capture previous status for audit
        const previousStatus = invoice.status;

        // Update admin approval
        const adminApproval = {
            status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            approvedBy: session.user.id,
            approvedAt: new Date().toISOString(),
            notes: notes || null
        };

        // Update overall status to final "Approved" or "Rejected"
        const newStatus = action === 'APPROVE' ? 'Approved' : 'Rejected';

        // Create comprehensive audit trail entry
        const auditTrailEntry = {
            action: `ADMIN_${action}`,
            actor: session.user.name || session.user.email,
            actorId: session.user.id,
            actorRole: 'ADMIN',
            timestamp: new Date().toISOString(),
            previousStatus: previousStatus,
            newStatus: newStatus,
            notes: notes || `Admin ${action.toLowerCase()}ed invoice`,
            ipAddress: ipAddress,
            userAgent: userAgent
        };

        const updatedInvoice = await db.saveInvoice(id, {
            adminApproval,
            status: newStatus,
            auditTrailEntry: auditTrailEntry,
            auditUsername: session.user.name || session.user.email,
            auditAction: `ADMIN_${action}`,
            auditDetails: `Admin ${action.toLowerCase()}ed invoice${notes ? `: ${notes}` : ''}`
        });

        const notificationType = action === 'APPROVE' ? 'PAID' : 'REJECTED';
        await sendStatusNotification(updatedInvoice, notificationType).catch((err) =>
            console.error('[Admin Approve] Notification failed:', err)
        );

        return NextResponse.json({
            success: true,
            message: `Invoice ${action.toLowerCase()}ed by Admin`,
            newStatus
        });
    } catch (error) {
        console.error('Error processing admin approval:', error);
        return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 });
    }
}
