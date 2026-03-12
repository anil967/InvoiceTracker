import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireRole, getNormalizedRole } from '@/lib/rbac';
import { sendStatusNotification } from '@/lib/notifications';
import { ROLES } from '@/constants/roles';
import { INVOICE_STATUS, generateAuditMessage } from '@/lib/invoice-workflow';
import { Message } from '@/models/Internal';
import { v4 as uuidv4 } from 'uuid';
import connectToDatabase from '@/lib/mongodb';

/**
 * POST /api/div-head/approve/:id - Divisional Head review and final approval (final FU-level step)
 * Reviews invoices AFTER Dept Head has approved (status: Pending Div Head Review)
 */
export async function POST(request, { params }) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.DIVISIONAL_HEAD, ROLES.ADMIN])(session.user);
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

        const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        const invoice = await db.getInvoice(id);
        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        const previousStatus = invoice.status;

        // Valid statuses for div head to review
        const VALID_DIV_HEAD_STATUSES = [
            INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW,
            'Pending Div Head Review',
        ];

        if (!VALID_DIV_HEAD_STATUSES.includes(invoice.status)) {
            return NextResponse.json(
                { error: `Invalid workflow state: Invoice status '${invoice.status}' is not pending Divisional Head review.` },
                { status: 400 }
            );
        }

        // Define action → new status mapping
        const DIV_HEAD_ACTION = {
            'APPROVE': INVOICE_STATUS.DIV_HEAD_APPROVED,
            'REJECT': INVOICE_STATUS.DIV_HEAD_REJECTED,
            'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED
        };

        const newStatus = DIV_HEAD_ACTION[action];

        const statusMap = { 'APPROVE': 'APPROVED', 'REJECT': 'REJECTED', 'REQUEST_INFO': 'INFO_REQUESTED' };
        const userRole = getNormalizedRole(session.user);

        const divHeadApproval = {
            status: statusMap[action],
            approvedBy: session.user.id,
            approvedByName: session.user.name || session.user.email,
            approvedByRole: userRole,
            approvedAt: new Date().toISOString(),
            notes: notes || null
        };

        const auditDetails = generateAuditMessage(
            action, 'Divisional Head', invoice.invoiceNumber, invoice.status, newStatus, notes
        );

        const auditTrailEntry = {
            action: action.toLowerCase() === 'request_info' ? 'requested_info' : action.toLowerCase(),
            actor: session.user.name || session.user.email,
            actorId: session.user.id,
            actorRole: userRole,
            timestamp: new Date().toISOString(),
            previousStatus,
            newStatus,
            notes: notes || `Divisional Head ${action.toLowerCase().replace('_', ' ')} this invoice`,
            ipAddress,
            userAgent
        };

        const updatedInvoice = await db.saveInvoice(id, {
            divHeadApproval,
            status: newStatus,
            auditUsername: session.user.name || session.user.email,
            auditAction: `DIV_HEAD_${action}`,
            auditDetails,
            auditTrailEntry
        });

        // Notify on rejection → send back to Dept Head
        if (action === 'REJECT') {
            try {
                await connectToDatabase();
                const deptHeadId = invoice.assignedDeptHead;
                if (deptHeadId) {
                    const deptHead = await db.getUserById(deptHeadId);
                    const invoiceLabel = updatedInvoice.invoiceNumber || updatedInvoice.id.slice(-6);
                    const msgId = uuidv4();
                    await Message.create({
                        id: msgId,
                        invoiceId: updatedInvoice.id,
                        projectId: updatedInvoice.project || null,
                        senderId: session.user.id,
                        senderName: session.user.name || session.user.email,
                        senderRole: userRole,
                        recipientId: deptHeadId,
                        recipientName: deptHead?.name || 'Department Head',
                        subject: `Div Head Rejected Invoice: ${invoiceLabel}`,
                        content: `Invoice ${invoiceLabel} has been rejected by Divisional Head.${notes ? ' Reason: ' + notes : ''}`,
                        messageType: 'REJECTION',
                        threadId: msgId
                    });
                }
                // Also notify the vendor
                const vendorId = updatedInvoice.submittedByUserId;
                if (vendorId) {
                    const vendor = await db.getUserById(vendorId);
                    const invoiceLabel = updatedInvoice.invoiceNumber || updatedInvoice.id.slice(-6);
                    const msgId2 = uuidv4();
                    await Message.create({
                        id: msgId2,
                        invoiceId: updatedInvoice.id,
                        projectId: updatedInvoice.project || null,
                        senderId: session.user.id,
                        senderName: session.user.name || session.user.email,
                        senderRole: userRole,
                        recipientId: vendorId,
                        recipientName: vendor?.name || 'Vendor',
                        subject: `Invoice Rejected: ${invoiceLabel}`,
                        content: `Your invoice ${invoiceLabel} has been rejected.${notes ? ' Reason: ' + notes : ''}`,
                        messageType: 'REJECTION',
                        threadId: msgId2
                    });
                }
            } catch (msgErr) {
                console.error('[Div Head Approve] Failed to notify on rejection:', msgErr);
            }
        }

        // On final approval, notify vendor + Admin for oversight
        if (action === 'APPROVE') {
            try {
                await connectToDatabase();
                const invoiceLabel = updatedInvoice.invoiceNumber || updatedInvoice.id.slice(-6);
                
                // Notify vendor
                const vendorId = updatedInvoice.submittedByUserId;
                if (vendorId) {
                    const vendor = await db.getUserById(vendorId);
                    const msgId = uuidv4();
                    await Message.create({
                        id: msgId,
                        invoiceId: updatedInvoice.id,
                        projectId: updatedInvoice.project || null,
                        senderId: session.user.id,
                        senderName: session.user.name || session.user.email,
                        senderRole: userRole,
                        recipientId: vendorId,
                        recipientName: vendor?.name || 'Vendor',
                        subject: `Invoice Final Approved: ${invoiceLabel}`,
                        content: `Your invoice ${invoiceLabel} has been finally approved by Divisional Head.${notes ? ' Notes: ' + notes : ''}`,
                        messageType: 'STATUS_UPDATE',
                        threadId: msgId
                    });
                }
                
                // Notify Admin for oversight
                const adminUsers = await db.getUsersByRole(ROLES.ADMIN);
                if (adminUsers && adminUsers.length > 0) {
                    for (const admin of adminUsers) {
                        const adminMsgId = uuidv4();
                        await Message.create({
                            id: adminMsgId,
                            invoiceId: updatedInvoice.id,
                            projectId: updatedInvoice.project || null,
                            senderId: session.user.id,
                            senderName: session.user.name || session.user.email,
                            senderRole: userRole,
                            recipientId: admin.id,
                            recipientName: admin?.name || 'Admin',
                            subject: `Invoice Final Approved (Oversight): ${invoiceLabel}`,
                            content: `Invoice ${invoiceLabel} has been finally approved by Divisional Head. ${notes ? 'Notes: ' + notes : ''}`,
                            messageType: 'STATUS_UPDATE',
                            threadId: adminMsgId
                        });
                    }
                }
            } catch (msgErr) {
                console.error('[Div Head Approve] Failed to notify on approval:', msgErr);
            }
        }

        const notificationType = action === 'APPROVE' ? 'FINANCE_APPROVED' :
            action === 'REJECT' ? 'FINANCE_REJECTED' : 'AWAITING_INFO';
        await sendStatusNotification(updatedInvoice, notificationType).catch(err =>
            console.error('[Div Head Approve] Notification failed:', err)
        );

        return NextResponse.json({
            success: true,
            message: `Divisional Head ${action.toLowerCase().replace('_', ' ')} invoice successfully`,
            newStatus,
            workflow: action === 'APPROVE' ? 'Invoice finally approved — workflow complete' :
                action === 'REQUEST_INFO' ? 'Awaiting additional information' :
                    'Workflow ended at Divisional Head stage'
        });
    } catch (error) {
        console.error('Error processing Divisional Head approval:', error);
        return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 });
    }
}
