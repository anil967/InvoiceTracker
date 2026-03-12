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
 * POST /api/dept-head/approve/:id - Department Head review and approval (first FU-level step)
 * Reviews invoices AFTER PM has approved (status: Pending Dept Head Review)
 */
export async function POST(request, { params }) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.DEPARTMENT_HEAD, ROLES.ADMIN])(session.user);
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

        // Valid statuses for dept head to review
        const VALID_DEPT_HEAD_STATUSES = [
            INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW,
            'Pending Dept Head Review',
        ];

        if (!VALID_DEPT_HEAD_STATUSES.includes(invoice.status)) {
            return NextResponse.json(
                { error: `Invalid workflow state: Invoice status '${invoice.status}' is not pending Department Head review.` },
                { status: 400 }
            );
        }

        // Define action → new status mapping
        const DEPT_HEAD_ACTION = {
            'APPROVE': INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW,
            'REJECT': INVOICE_STATUS.DEPT_HEAD_REJECTED,
            'REQUEST_INFO': INVOICE_STATUS.MORE_INFO_NEEDED
        };

        const newStatus = DEPT_HEAD_ACTION[action];

        // Dept Head approval record
        const statusMap = { 'APPROVE': 'APPROVED', 'REJECT': 'REJECTED', 'REQUEST_INFO': 'INFO_REQUESTED' };
        const userRole = getNormalizedRole(session.user);

        const deptHeadApproval = {
            status: statusMap[action],
            approvedBy: session.user.id,
            approvedByName: session.user.name || session.user.email,
            approvedByRole: userRole,
            approvedAt: new Date().toISOString(),
            notes: notes || null
        };

        const auditDetails = generateAuditMessage(
            action, 'Department Head', invoice.invoiceNumber, invoice.status, newStatus, notes
        );

        const auditTrailEntry = {
            action: action.toLowerCase() === 'request_info' ? 'requested_info' : action.toLowerCase(),
            actor: session.user.name || session.user.email,
            actorId: session.user.id,
            actorRole: userRole,
            timestamp: new Date().toISOString(),
            previousStatus,
            newStatus,
            notes: notes || `Department Head ${action.toLowerCase().replace('_', ' ')} this invoice`,
            ipAddress,
            userAgent
        };

        // Resolve Divisional Head from Dept Head's managedBy hierarchy on approve
        let resolvedDivHeadId = invoice.assignedDivHead || null;
        if (action === 'APPROVE' && !resolvedDivHeadId) {
            const deptUser = await db.getUserById(session.user.id);
            if (deptUser?.managedBy) {
                const divUser = await db.getUserById(deptUser.managedBy);
                if (divUser && [ROLES.DIVISIONAL_HEAD, ROLES.ADMIN].includes(getNormalizedRole(divUser))) {
                    resolvedDivHeadId = divUser.id;
                    console.log(`[Dept Head Approve] Auto-assigned Div Head ${divUser.id} (${divUser.name})`);
                } else {
                    console.warn(`[Dept Head Approve] managedBy ${deptUser.managedBy} is not a Div Head (role: ${divUser?.role})`);
                }
            } else {
                console.warn(`[Dept Head Approve] Dept Head ${session.user.id} has no managedBy set.`);
            }
        }

        const updatedInvoice = await db.saveInvoice(id, {
            deptHeadApproval,
            assignedDivHead: resolvedDivHeadId,
            status: newStatus,
            auditUsername: session.user.name || session.user.email,
            auditAction: `DEPT_HEAD_${action}`,
            auditDetails,
            auditTrailEntry
        });

        // Notify Divisional Head on approve
        if (action === 'APPROVE') {
            try {
                await connectToDatabase();
                if (resolvedDivHeadId) {
                    const divHead = await db.getUserById(resolvedDivHeadId);
                    const invoiceLabel = updatedInvoice.invoiceNumber || updatedInvoice.id.slice(-6);
                    const msgId = uuidv4();
                    await Message.create({
                        id: msgId,
                        invoiceId: updatedInvoice.id,
                        projectId: updatedInvoice.project || null,
                        senderId: session.user.id,
                        senderName: session.user.name || session.user.email,
                        senderRole: userRole,
                        recipientId: resolvedDivHeadId,
                        recipientName: divHead?.name || 'Divisional Head',
                        subject: `Dept Head Approved Invoice: ${invoiceLabel} — Ready for Final Review`,
                        content: `Invoice ${invoiceLabel} has been approved by Department Head and is now pending your final Divisional Head review.${notes ? ' Notes: ' + notes : ''}`,
                        messageType: 'STATUS_UPDATE',
                        threadId: msgId
                    });
                }
            } catch (msgErr) {
                console.error('[Dept Head Approve] Failed to notify Div Head:', msgErr);
            }
        }

        // Notify PM on rejection
        if (action === 'REJECT') {
            try {
                await connectToDatabase();
                const pmId = invoice.assignedPM;
                if (pmId) {
                    const pm = await db.getUserById(pmId);
                    const invoiceLabel = updatedInvoice.invoiceNumber || updatedInvoice.id.slice(-6);
                    const msgId = uuidv4();
                    await Message.create({
                        id: msgId,
                        invoiceId: updatedInvoice.id,
                        projectId: updatedInvoice.project || null,
                        senderId: session.user.id,
                        senderName: session.user.name || session.user.email,
                        senderRole: userRole,
                        recipientId: pmId,
                        recipientName: pm?.name || 'Project Manager',
                        subject: `Dept Head Rejected Invoice: ${invoiceLabel}`,
                        content: `Invoice ${invoiceLabel} has been rejected by Department Head.${notes ? ' Reason: ' + notes : ''}`,
                        messageType: 'REJECTION',
                        threadId: msgId
                    });
                }
            } catch (msgErr) {
                console.error('[Dept Head Approve] Failed to notify PM on rejection:', msgErr);
            }
        }

        const notificationType = action === 'APPROVE' ? 'PENDING_APPROVAL' :
            action === 'REJECT' ? 'REJECTED' : 'AWAITING_INFO';
        await sendStatusNotification(updatedInvoice, notificationType).catch(err =>
            console.error('[Dept Head Approve] Notification failed:', err)
        );

        return NextResponse.json({
            success: true,
            message: `Department Head ${action.toLowerCase().replace('_', ' ')} invoice successfully`,
            newStatus,
            workflow: action === 'APPROVE' ? 'Proceeding to Divisional Head review' :
                action === 'REQUEST_INFO' ? 'Awaiting additional information' :
                    'Workflow ended at Department Head stage'
        });
    } catch (error) {
        console.error('Error processing Department Head approval:', error);
        return NextResponse.json({ error: 'Failed to process approval' }, { status: 500 });
    }
}
