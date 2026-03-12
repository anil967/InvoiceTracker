import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireRole, getNormalizedRole } from '@/lib/rbac';
import { sendStatusNotification } from '@/lib/notifications';
import { ROLES } from '@/constants/roles';
import {
    INVOICE_STATUS,
    validateTransition,
    generateAuditMessage
} from '@/lib/invoice-workflow';

/**
 * POST /api/finance/approve/:id - Finance review and approval (SECOND approval step)
 * Finance reviews invoice AFTER PM has approved
 */
export async function POST(request, { params }) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.FINANCE_USER, ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { action, notes } = body;

        if (!action || !['APPROVE', 'REJECT', 'REQUEST_INFO'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Must be APPROVE, REJECT, or REQUEST_INFO' },
                { status: 400 }
            );
        }

        // Capture request metadata for comprehensive audit logging
        const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        const invoice = await db.getInvoice(id);
        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        // Capture previous status for audit
        const previousStatus = invoice.status;

        // Validate workflow state using state machine
        // Finance can review invoices in any of these statuses
        const FINANCE_ACTION = {
            'APPROVE': INVOICE_STATUS.FINANCE_APPROVED,
            'REJECT': INVOICE_STATUS.FINANCE_REJECTED,
            'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED
        };

        const VALID_FINANCE_STATUSES = [
            INVOICE_STATUS.PENDING_FINANCE_REVIEW,
            'Pending Finance Review',
            'PM Approved',
            'PM_APPROVED',
            'APPROVED',
            'VERIFIED',
            'RECEIVED',
            // Invoices submitted directly without a full PM-workflow pass
            'Submitted',
            'SUBMITTED',
        ];

        if (!VALID_FINANCE_STATUSES.includes(invoice.status)) {
            return NextResponse.json(
                { error: `Invalid workflow state: Invoice status '${invoice.status}' is not pending Finance review. Finance can only review invoices in statuses: ${VALID_FINANCE_STATUSES.join(', ')}` },
                { status: 400 }
            );
        }

        // Build dynamic transition map — every valid status maps to the same 3 outcomes
        const statusTransitions = {};
        for (const s of VALID_FINANCE_STATUSES) {
            statusTransitions[s] = { ...FINANCE_ACTION };
        }

        // Determine new status based on action
        const newStatus = statusTransitions[invoice.status]?.[action];
        if (!newStatus) {
            return NextResponse.json(
                { error: `Invalid action '${action}' for invoice status '${invoice.status}'` },
                { status: 400 }
            );
        }

        // Validate the transition is allowed (only for standard workflow)
        // Manual entries or legacy invoices bypass strict transition validation
        if (invoice.status === INVOICE_STATUS.PENDING_FINANCE_REVIEW) {
            const role = requireRole([ROLES.FINANCE_USER, ROLES.ADMIN]).role || ROLES.FINANCE_USER;
            const transitionValidation = validateTransition(
                invoice.status,
                newStatus,
                role
            );
            if (!transitionValidation.allowed) {
                return NextResponse.json(
                    { error: transitionValidation.reason },
                    { status: 400 }
                );
            }
        }

        // Update finance approval (SECOND approval step)
        const statusMap = {
            'APPROVE': 'APPROVED',
            'REJECT': 'REJECTED',
            'REQUEST_INFO': 'INFO_REQUESTED'
        };

        const role = requireRole([ROLES.FINANCE_USER, ROLES.ADMIN]).role || ROLES.FINANCE_USER;
        const financeApproval = {
            status: statusMap[action],
            approvedBy: session.user.id,
            approvedByName: session.user.name || session.user.email,
            approvedByRole: role,
            approvedAt: new Date().toISOString(),
            notes: notes || null
        };

        // Generate audit message using workflow function
        const roleName = getNormalizedRole(session.user);
        const auditDetails = generateAuditMessage(
            action,
            'Finance',
            invoice.invoiceNumber,
            invoice.status,
            newStatus,
            notes
        );

        // Create comprehensive audit entry
        const auditTrailEntry = {
            action: action.toLowerCase() === 'request_info' ? 'requested_info' : action.toLowerCase(),
            actor: session.user.name || session.user.email,
            actorId: session.user.id,
            actorRole: role,
            timestamp: new Date().toISOString(),
            previousStatus: previousStatus,
            newStatus: newStatus,
            notes: notes || `Finance ${action.toLowerCase().replace('_', ' ')} this invoice`,
            ipAddress: ipAddress,
            userAgent: userAgent
        };

        const updatedInvoice = await db.saveInvoice(id, {
            financeApproval,
            status: newStatus,
            auditUsername: session.user.name || session.user.email,
            auditAction: `FINANCE_${action}`,
            auditDetails,
            auditTrailEntry
        });

        const notificationType = action === 'APPROVE' ? 'FINANCE_APPROVED' :
            action === 'REJECT' ? 'FINANCE_REJECTED' :
                'AWAITING_INFO';
        await sendStatusNotification(updatedInvoice, notificationType).catch((err) =>
            console.error('[Finance Approve] Notification failed:', err)
        );

        return NextResponse.json({
            success: true,
            message: `Finance ${action.toLowerCase().replace('_', ' ')} invoice successfully`,
            newStatus,
            workflow: action === 'APPROVE' ? 'Invoice approved for payment' :
                action === 'REQUEST_INFO' ? 'Awaiting additional information' :
                    'Workflow ended at Finance stage'
        });
    } catch (error) {
        console.error('Error processing finance approval:', error);
        return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 });
    }
}
