import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireRole, checkPermission, getNormalizedRole } from '@/lib/rbac';
import { sendStatusNotification } from '@/lib/notifications';
import { ROLES } from '@/constants/roles';
import { Message } from '@/models/Internal';
import { v4 as uuidv4 } from 'uuid';
import connectToDatabase from '@/lib/mongodb';
import {
    INVOICE_STATUS,
    validateTransition,
    generateAuditMessage
} from '@/lib/invoice-workflow';

/**
 * POST /api/pm/approve/:id - PM approval for invoice
 */
export async function POST(request, { params }) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN, ROLES.PROJECT_MANAGER])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        const userRole = getNormalizedRole(session.user);

        const { id } = await params;
        const body = await request.json();
        const { action, notes } = body;

        if (!action || !['APPROVE', 'REJECT', 'REQUEST_INFO', 'RECHECK'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Must be APPROVE, REJECT, REQUEST_INFO, or RECHECK' },
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

        // Validate workflow state - PM can review invoices in various statuses
        // This matches the filter logic in app/pm/approval-queue/page.jsx
        const allowPMReview = [
            'RECEIVED',
            'DIGITIZING',
            'VALIDATION_REQUIRED',
            'VERIFIED',
            'PENDING_APPROVAL',
            'MATCH_DISCREPANCY',
            'Pending',
            INVOICE_STATUS.SUBMITTED,
            INVOICE_STATUS.PENDING_PM_APPROVAL,
            INVOICE_STATUS.MORE_INFO_NEEDED,
            INVOICE_STATUS.RECHECK_BY_DEPT_HEAD  // Dept Head sent back to PM
        ].includes(invoice.status) || !invoice.pmApproval?.status || invoice.pmApproval?.status === 'PENDING' || invoice.pmApproval?.status === 'INFO_REQUESTED';

        if (!allowPMReview) {
            return NextResponse.json(
                { error: `Invalid workflow state: Invoice status '${invoice.status}' is not valid for PM review. Valid statuses: RECEIVED, DIGITIZING, VALIDATION_REQUIRED, VERIFIED, PENDING_APPROVAL, MATCH_DISCREPANCY, PENDING_PM_APPROVAL, or pmApproval.isEmpty()` },
                { status: 400 }
            );
        }

        // Prevent workflow issues - Finance should not have reviewed yet
        if (invoice.financeApproval?.status && invoice.financeApproval?.status !== 'PENDING') {
            return NextResponse.json(
                { error: 'Invalid workflow: Finance already reviewed this invoice before PM' },
                { status: 400 }
            );
        }

        // Check PM has access to this project (skip for admin)
        if (userRole === ROLES.PROJECT_MANAGER) {
            if (!checkPermission(session.user, 'APPROVE_INVOICE', invoice)) {
                return NextResponse.json(
                    { error: 'You are not authorized to approve invoices for this project' },
                    { status: 403 }
                );
            }
        }

        // Define status transitions for PM actions using constants
        // PM APPROVE now routes to Dept Head (new flow)
        const PM_APPROVE_STATUS = INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW;
        const statusTransitions = {
            'DIGITIZING': {
                'APPROVE': PM_APPROVE_STATUS,
                'REJECT': INVOICE_STATUS.PM_REJECTED,
                'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED,
                'RECHECK': INVOICE_STATUS.MORE_INFO_NEEDED  // PM re-check sends to Vendor
            },
            'VALIDATION_REQUIRED': {
                'APPROVE': PM_APPROVE_STATUS,
                'REJECT': INVOICE_STATUS.PM_REJECTED,
                'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED,
                'RECHECK': INVOICE_STATUS.MORE_INFO_NEEDED
            },
            'VERIFIED': {
                'APPROVE': PM_APPROVE_STATUS,
                'REJECT': INVOICE_STATUS.PM_REJECTED,
                'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED,
                'RECHECK': INVOICE_STATUS.MORE_INFO_NEEDED
            },
            'PENDING_APPROVAL': {
                'APPROVE': PM_APPROVE_STATUS,
                'REJECT': INVOICE_STATUS.PM_REJECTED,
                'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED,
                'RECHECK': INVOICE_STATUS.MORE_INFO_NEEDED
            },
            'MATCH_DISCREPANCY': {
                'APPROVE': PM_APPROVE_STATUS,
                'REJECT': INVOICE_STATUS.PM_REJECTED,
                'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED,
                'RECHECK': INVOICE_STATUS.MORE_INFO_NEEDED
            },
            [INVOICE_STATUS.SUBMITTED]: {
                'APPROVE': PM_APPROVE_STATUS,
                'REJECT': INVOICE_STATUS.PM_REJECTED,
                'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED,
                'RECHECK': INVOICE_STATUS.MORE_INFO_NEEDED
            },
            'Pending': {
                'APPROVE': PM_APPROVE_STATUS,
                'REJECT': INVOICE_STATUS.PM_REJECTED,
                'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED,
                'RECHECK': INVOICE_STATUS.MORE_INFO_NEEDED
            },
            [INVOICE_STATUS.MORE_INFO_NEEDED]: {
                'APPROVE': PM_APPROVE_STATUS,
                'REJECT': INVOICE_STATUS.PM_REJECTED,
                'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED,
                'RECHECK': INVOICE_STATUS.MORE_INFO_NEEDED
            },
            // PM acts on invoices returned by Dept Head re-check
            [INVOICE_STATUS.RECHECK_BY_DEPT_HEAD]: {
                'APPROVE': PM_APPROVE_STATUS,                  // Re-approve → back to Dept Head
                'REJECT': INVOICE_STATUS.PM_REJECTED,          // PM rejects
                'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED, // Request info from vendor
                'RECHECK': INVOICE_STATUS.MORE_INFO_NEEDED     // Send to vendor for info
            }
        };

        // Determine new status based on action
        let newStatus = statusTransitions[invoice.status]?.[action];
        console.log('[PM Approve] Status mapping:', {
            invoiceStatus: invoice.status,
            action: action,
            newStatus: newStatus,
            statusTransitionsKeys: Object.keys(statusTransitions),
            hasMapping: !!statusTransitions[invoice.status],
            allowPMReview: allowPMReview
        });

        // Fallback: If no mapping exists but PM is allowed to review, use default transitions
        if (!newStatus && allowPMReview) {
            // Default PM transitions when no explicit mapping exists
            if (action === 'APPROVE') {
                newStatus = PM_APPROVE_STATUS;
            } else if (action === 'REJECT') {
                newStatus = INVOICE_STATUS.PM_REJECTED;
            } else if (action === 'REQUEST_INFO' || action === 'RECHECK') {
                newStatus = INVOICE_STATUS.MORE_INFO_NEEDED;
            }
            console.log('[PM Approve] Using fallback status transition:', { action, newStatus });
        }

        if (!newStatus) {
            return NextResponse.json(
                { error: `Invalid action '${action}' for invoice status '${invoice.status}'` },
                { status: 400 }
            );
        }

        // Validate the transition is allowed (only for statuses in the workflow state machine)
        // Skip strict validation for rejections when PM is allowed to review to prevent false-negative blocks
        const workflowStatuses = Object.values(INVOICE_STATUS);
        if (workflowStatuses.includes(invoice.status) && action !== 'REJECT') {
            const transitionValidation = validateTransition(
                invoice.status,
                newStatus,
                userRole
            );
            if (!transitionValidation.allowed) {
                return NextResponse.json(
                    { error: transitionValidation.reason },
                    { status: 400 }
                );
            }
        }

        // Update PM approval
        const statusMap = {
            'APPROVE': 'APPROVED',
            'REJECT': 'REJECTED',
            'REQUEST_INFO': 'INFO_REQUESTED',
            'RECHECK': 'INFO_REQUESTED'
        };

        const pmApproval = {
            status: statusMap[action],
            approvedBy: session.user.id,
            approvedByName: session.user.name || session.user.email,
            approvedByRole: userRole,
            approvedAt: new Date().toISOString(),
            notes: notes || null
        };

        // Generate audit message using workflow function
        const roleName = getNormalizedRole(session.user);
        const auditDetails = generateAuditMessage(
            action,
            roleName,
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
            actorRole: userRole,
            timestamp: new Date().toISOString(),
            previousStatus: previousStatus,
            newStatus: newStatus,
            notes: notes || `PM ${action.toLowerCase().replace('_', ' ')} this invoice`,
            ipAddress: ipAddress,
            userAgent: userAgent
        };

        // Resolve Department Head from hierarchy when PM approves.
        // The PM's `managedBy` field points to their Department Head.
        let resolvedDeptHeadId = invoice.assignedDeptHead || null;
        if (action === 'APPROVE' && !resolvedDeptHeadId) {
            const pmUser = await db.getUserById(session.user.id);
            if (pmUser?.managedBy) {
                const deptUser = await db.getUserById(pmUser.managedBy);
                if (deptUser && [ROLES.DEPARTMENT_HEAD, ROLES.ADMIN].includes(getNormalizedRole(deptUser))) {
                    resolvedDeptHeadId = deptUser.id;
                    console.log(`[PM Approve] Auto-assigned Dept Head ${deptUser.id} (${deptUser.name}) from PM hierarchy.`);
                } else {
                    console.warn(`[PM Approve] PM managedBy user ${pmUser.managedBy} is not a Dept Head (role: ${deptUser?.role}). Will not auto-assign.`);
                }
            } else {
                console.warn(`[PM Approve] PM user ${session.user.id} has no managedBy set. Invoice will not appear in any Dept Head queue.`);
            }
        }

        const updatedInvoice = await db.saveInvoice(id, {
            pmApproval,
            assignedDeptHead: resolvedDeptHeadId,
            status: newStatus,
            auditUsername: session.user.name || session.user.email,
            auditAction: `PM_${action}`,
            auditDetails,
            auditTrailEntry
        });

        // Automated Messaging for Info Request / Re-check - notifies Vendor
        if (action === 'REQUEST_INFO' || action === 'RECHECK') {
            try {
                await connectToDatabase();

                // Use a reliable identifier for the vendor (the submitter)
                const recipientId = updatedInvoice.submittedByUserId || invoice.submittedByUserId;

                if (recipientId) {
                    const vendor = await db.getUserById(recipientId);
                    const messageId = uuidv4();

                    // Create the message record
                    await Message.create({
                        id: messageId,
                        invoiceId: updatedInvoice.id,
                        projectId: updatedInvoice.project || invoice.project || null,
                        senderId: session.user.id,
                        senderName: session.user.name || session.user.email,
                        senderRole: userRole,
                        recipientId: recipientId,
                        recipientName: vendor?.name || 'Vendor',
                        subject: `PM Info Required: Invoice ${updatedInvoice.invoiceNumber || updatedInvoice.id.slice(-6)}`,
                        content: notes || 'The Project Manager has requested additional information for your invoice.',
                        messageType: 'INFO_REQUEST',
                        threadId: messageId
                    });

                    console.log(`[PM Action] Info request message successfully sent to vendor (${recipientId})`);
                } else {
                    console.warn(`[PM Action] No recipient ID found for invoice ${id}, cannot send message.`);
                }
            } catch (msgErr) {
                console.error('[PM Action] Failed to create info request message:', msgErr);
                // We don't fail the whole request if message sending fails, but we log it
            }
        }

        // Notify Vendor on PM rejection (Finance hasn't seen it yet)
        if (action === 'REJECT') {
            try {
                await connectToDatabase();
                const invoiceLabel = updatedInvoice.invoiceNumber || invoice.invoiceNumber || updatedInvoice.id.slice(-6);

                // Notify Vendor
                const vendorId = updatedInvoice.submittedByUserId || invoice.submittedByUserId;
                if (vendorId) {
                    const vendor = await db.getUserById(vendorId);
                    const msgId = uuidv4();

                    await Message.create({
                        id: msgId,
                        invoiceId: updatedInvoice.id,
                        projectId: updatedInvoice.project || invoice.project || null,
                        senderId: session.user.id,
                        senderName: session.user.name || session.user.email,
                        senderRole: userRole,
                        recipientId: vendorId,
                        recipientName: vendor?.name || 'Vendor',
                        subject: `Invoice Rejected: ${invoiceLabel}`,
                        content: notes || `The Project Manager has rejected the invoice. Reason: ${notes || 'No reason specified'}`,
                        messageType: 'REJECTION',
                        threadId: msgId
                    });
                    console.log(`[PM Action] Rejection message successfully sent to vendor (${vendorId})`);
                } else {
                    console.warn(`[PM Action] No vendor ID found for invoice ${id}, cannot send rejection message.`);
                }
            } catch (err) {
                console.error('[PM Action] Failed to send rejection message:', err);
            }
        }

        // Notify Department Head about PM decision (approve or reject)
        try {
            await connectToDatabase();
            const deptHeadId = resolvedDeptHeadId || invoice.assignedDeptHead;
            if (deptHeadId) {
                const deptHead = await db.getUserById(deptHeadId);
                const invoiceLabel = updatedInvoice.invoiceNumber || updatedInvoice.id.slice(-6);
                const msgId = uuidv4();
                const isApproval = action === 'APPROVE';
                await Message.create({
                    id: msgId,
                    invoiceId: updatedInvoice.id,
                    projectId: updatedInvoice.project || null,
                    senderId: session.user.id,
                    senderName: session.user.name || session.user.email,
                    senderRole: userRole,
                    recipientId: deptHeadId,
                    recipientName: deptHead?.name || 'Department Head',
                    subject: isApproval
                        ? `PM Approved Invoice: ${invoiceLabel} — Ready for Your Review`
                        : `PM Rejected Invoice: ${invoiceLabel}`,
                    content: isApproval
                        ? `Invoice ${invoiceLabel} has been approved by PM and is now pending your Department Head review.${notes ? ' PM Notes: ' + notes : ''}`
                        : `Invoice ${invoiceLabel} has been rejected by PM.${notes ? ' Reason: ' + notes : ''}`,
                    messageType: isApproval ? 'STATUS_UPDATE' : 'REJECTION',
                    threadId: msgId
                });
                console.log(`[PM Action] Dept Head notification sent to ${deptHeadId} (${action})`);
            }
        } catch (msgErr) {
            console.error('[PM Action] Failed to send dept head notification:', msgErr);
        }

        // Determine notification type based on action
        const notificationType = action === 'REJECT' ? 'REJECTED' :
            action === 'REQUEST_INFO' || action === 'RECHECK' ? 'AWAITING_INFO' :
                'PENDING_APPROVAL';
        await sendStatusNotification(updatedInvoice, notificationType).catch((err) =>
            console.error('[PM Approve] Notification failed:', err)
        );

        // Determine workflow message based on action
        const workflowMessage = action === 'APPROVE' ? 'Proceeding to Department Head review' :
            action === 'REQUEST_INFO' || action === 'RECHECK' ? 'Awaiting information from vendor' :
                'Workflow ended at PM stage';

        return NextResponse.json({
            success: true,
            message: `PM ${action.toLowerCase().replace('_', ' ')} invoice successfully`,
            newStatus,
            workflow: workflowMessage
        });
    } catch (error) {
        console.error('Error processing PM approval:', error);
        return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 });
    }
}
