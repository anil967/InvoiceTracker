import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendStatusNotification } from '@/lib/notifications';
import { getCurrentUser } from '@/lib/server-auth';
import { INVOICE_STATUS, validateTransition } from '@/lib/invoice-workflow';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
    const { id } = await params;
    const { action, comments } = await request.json();

    // Capture request metadata for audit trail early
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Strict Auth Check
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ROLES, getNormalizedRole } = await import('@/constants/roles');
    const userRole = getNormalizedRole(user);

    const invoice = await db.getInvoice(id);
    if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Capture previous status for audit
    const previousStatus = invoice.status;

    let nextStatus = invoice.status;
    const timestampUpdates = {};
    const auditLog = {
        invoice_id: id,
        username: user.name || user.email || userRole || 'System',
        action: action,
        details: comments || `Action ${action} performed on invoice ${id}`
    };

    // Initialize approval updates
    const approvalUpdates = {};
    const statusMap = {
        'APPROVE': 'APPROVED',
        'REJECT': 'REJECTED',
        'REQUEST_INFO': 'INFO_REQUESTED'
    };

    // State Machine aligned with invoice-workflow.js INVOICE_STATUS
    try {
        if (action === 'APPROVE') {
            // ─── PM Approval ───
            if (userRole === ROLES.PROJECT_MANAGER) {
                // PM can approve invoices in Submitted or Pending PM Approval status
                if (invoice.status !== INVOICE_STATUS.SUBMITTED &&
                    invoice.status !== INVOICE_STATUS.PENDING_PM_APPROVAL) {
                    return NextResponse.json({ error: `PM cannot approve invoices in '${invoice.status}' status.` }, { status: 400 });
                }

                // Verify PM is assigned to this invoice/project
                const isPmForProject = user.assignedProjects?.includes(invoice.project);
                const isPmForInvoice = invoice.assignedPM === String(user.id);
                if (!isPmForProject && !isPmForInvoice) {
                    return NextResponse.json({ error: 'You are not authorized to approve this invoice (not assigned to this project/invoice).' }, { status: 403 });
                }

                // PM Approved → auto-advance to Pending Finance Review
                nextStatus = INVOICE_STATUS.PENDING_FINANCE_REVIEW;
                timestampUpdates.pmApprovedAt = new Date().toISOString();
                approvalUpdates.pmApproval = {
                    status: 'APPROVED',
                    approvedBy: String(user.id),
                    approvedByRole: userRole,
                    approvedAt: new Date().toISOString(),
                    notes: comments || 'PM Approved'
                };
                auditLog.details = `PM Approved: ${comments || 'No comments'}. Auto-advanced to Pending Finance Review.`;
            }
            // ─── Finance User Approval ───
            else if (userRole === ROLES.FINANCE_USER) {
                if (invoice.status !== INVOICE_STATUS.PENDING_FINANCE_REVIEW) {
                    return NextResponse.json({ error: `Finance User cannot approve invoices in '${invoice.status}' status.` }, { status: 400 });
                }

                nextStatus = INVOICE_STATUS.FINANCE_APPROVED;
                timestampUpdates.financeApprovedAt = new Date().toISOString();
                approvalUpdates.financeApproval = {
                    status: 'APPROVED',
                    approvedBy: String(user.id),
                    approvedByRole: userRole,
                    approvedAt: new Date().toISOString(),
                    notes: comments || 'Finance Approved'
                };
                auditLog.details = `Finance Approved: ${comments || 'No comments'}`;
            }
            // ─── Admin Override Approval ───
            else if (userRole === ROLES.ADMIN) {
                // Admin can approve at any stage
                if (invoice.status === INVOICE_STATUS.SUBMITTED ||
                    invoice.status === INVOICE_STATUS.PENDING_PM_APPROVAL) {
                    // Admin approves vendor submission → advance to Pending PM Approval
                    nextStatus = INVOICE_STATUS.PENDING_PM_APPROVAL;
                    approvalUpdates.pmApproval = {
                        status: 'PENDING',
                        notes: comments || 'Admin approved submission'
                    };
                    auditLog.details = `Admin approved vendor submission → Pending PM Approval: ${comments || 'No comments'}`;
                } else if (invoice.status === INVOICE_STATUS.PENDING_FINANCE_REVIEW) {
                    // Admin can finalize finance approval
                    nextStatus = INVOICE_STATUS.FINANCE_APPROVED;
                    timestampUpdates.financeApprovedAt = new Date().toISOString();
                    approvalUpdates.financeApproval = {
                        status: 'APPROVED',
                        approvedBy: String(user.id),
                        approvedByRole: userRole,
                        approvedAt: new Date().toISOString(),
                        notes: comments || 'Admin Finance Approved'
                    };
                    auditLog.details = `Admin Finance Approved: ${comments || 'No comments'}`;
                } else if (invoice.status === 'MATCH_DISCREPANCY' || invoice.status === 'VALIDATION_REQUIRED') {
                    // Admin manual override for discrepancies
                    nextStatus = INVOICE_STATUS.PENDING_PM_APPROVAL;
                    auditLog.details = `Admin resolved discrepancy → Pending PM Approval: ${comments || 'No comments'}`;
                } else {
                    // Generic admin approval - move to next logical stage
                    nextStatus = INVOICE_STATUS.PENDING_PM_APPROVAL;
                    auditLog.details = `Admin override approval: ${comments || 'No comments'}`;
                }
            } else {
                return NextResponse.json({ error: 'Unauthorized to approve invoices.' }, { status: 403 });
            }
        }
        // ─── REJECT ───
        else if (action === 'REJECT') {
            if (userRole === ROLES.PROJECT_MANAGER) {
                if (invoice.status !== INVOICE_STATUS.SUBMITTED &&
                    invoice.status !== INVOICE_STATUS.PENDING_PM_APPROVAL) {
                    return NextResponse.json({ error: `PM cannot reject invoices in '${invoice.status}' status.` }, { status: 400 });
                }
                nextStatus = INVOICE_STATUS.PM_REJECTED;
                approvalUpdates.pmApproval = {
                    status: 'REJECTED',
                    approvedBy: String(user.id),
                    approvedByRole: userRole,
                    approvedAt: new Date().toISOString(),
                    notes: comments || 'PM Rejected'
                };
                auditLog.details = `PM Rejected: ${comments || 'No reasons provided'}`;
            } else if (userRole === ROLES.FINANCE_USER) {
                if (invoice.status !== INVOICE_STATUS.PENDING_FINANCE_REVIEW) {
                    return NextResponse.json({ error: `Finance User cannot reject invoices in '${invoice.status}' status.` }, { status: 400 });
                }
                nextStatus = INVOICE_STATUS.FINANCE_REJECTED;
                approvalUpdates.financeApproval = {
                    status: 'REJECTED',
                    approvedBy: String(user.id),
                    approvedByRole: userRole,
                    approvedAt: new Date().toISOString(),
                    notes: comments || 'Finance Rejected'
                };
                auditLog.details = `Finance Rejected: ${comments || 'No reasons provided'}`;
            } else if (userRole === ROLES.ADMIN) {
                // Admin can reject at any stage
                if (invoice.status === INVOICE_STATUS.PENDING_PM_APPROVAL ||
                    invoice.status === INVOICE_STATUS.SUBMITTED) {
                    nextStatus = INVOICE_STATUS.PM_REJECTED;
                    approvalUpdates.pmApproval = {
                        status: 'REJECTED',
                        approvedBy: String(user.id),
                        approvedAt: new Date().toISOString(),
                        notes: comments || 'Admin Rejected'
                    };
                } else {
                    nextStatus = INVOICE_STATUS.FINANCE_REJECTED;
                    approvalUpdates.financeApproval = {
                        status: 'REJECTED',
                        approvedBy: String(user.id),
                        approvedAt: new Date().toISOString(),
                        notes: comments || 'Admin Rejected Finance'
                    };
                }
                auditLog.details = `Admin Rejected: ${comments || 'No reasons provided'}`;
            } else {
                return NextResponse.json({ error: 'Unauthorized to reject invoices.' }, { status: 403 });
            }
        }
        // ─── REQUEST_INFO (Send back to vendor for more info) ───
        else if (action === 'REQUEST_INFO') {
            if (![ROLES.PROJECT_MANAGER, ROLES.ADMIN, ROLES.FINANCE_USER].includes(userRole)) {
                return NextResponse.json({ error: 'Unauthorized to request info.' }, { status: 403 });
            }
            nextStatus = INVOICE_STATUS.MORE_INFO_NEEDED;
            if (userRole === ROLES.PROJECT_MANAGER) {
                approvalUpdates.pmApproval = { status: 'INFO_REQUESTED', notes: comments };
            } else if (userRole === ROLES.FINANCE_USER) {
                approvalUpdates.financeApproval = { status: 'INFO_REQUESTED', notes: comments };
            }
            auditLog.details = `More Info Requested by ${userRole}: ${comments || 'No specific requests'}`;
        }
        // ─── SEND_BACK (Finance sends back to PM review) ───
        else if (action === 'SEND_BACK') {
            if (userRole === ROLES.FINANCE_USER || userRole === ROLES.ADMIN) {
                nextStatus = INVOICE_STATUS.PENDING_PM_APPROVAL;
                approvalUpdates.financeApproval = { status: 'PENDING', notes: 'Sent back to PM: ' + comments };
                approvalUpdates.pmApproval = { status: 'PENDING', notes: 'Re-review requested by Finance' };
                auditLog.details = `Sent back to PM review by ${userRole}: ${comments || 'No comments'}`;
            } else {
                return NextResponse.json({ error: 'Only Finance User or Admin can send back to PM.' }, { status: 403 });
            }
        }
        // ─── RESUBMIT (Vendor resubmits after info request) ───
        else if (action === 'RESUBMIT') {
            if (userRole !== ROLES.VENDOR) {
                return NextResponse.json({ error: 'Only Vendor can resubmit.' }, { status: 403 });
            }
            if (invoice.status !== INVOICE_STATUS.MORE_INFO_NEEDED) {
                return NextResponse.json({ error: 'Can only resubmit invoices that need more info.' }, { status: 400 });
            }
            nextStatus = INVOICE_STATUS.PENDING_PM_APPROVAL;
            approvalUpdates.pmApproval = { status: 'PENDING', notes: 'Resubmitted by vendor' };
            auditLog.details = `Vendor resubmitted with additional info: ${comments || 'No comments'}`;
        }
        // ─── RESTORE (Admin restores rejected invoices) ───
        else if (action === 'RESTORE') {
            if (userRole !== ROLES.ADMIN) {
                return NextResponse.json({ error: 'Only Admin can restore invoices.' }, { status: 403 });
            }
            const rejectStatuses = [
                INVOICE_STATUS.PM_REJECTED,
                INVOICE_STATUS.FINANCE_REJECTED
            ];
            if (!rejectStatuses.includes(invoice.status)) {
                return NextResponse.json({ error: 'Can only restore REJECTED invoices.' }, { status: 400 });
            }
            nextStatus = INVOICE_STATUS.PENDING_PM_APPROVAL;
            approvalUpdates.pmApproval = { status: 'PENDING', notes: 'Restored by Admin' };
            approvalUpdates.financeApproval = { status: 'PENDING' };
            auditLog.details = `Invoice restored to PM review by Admin: ${comments || 'No comments'}`;
        }
        // ─── Unknown action ───
        else {
            return NextResponse.json({ error: `Unknown workflow action: ${action}` }, { status: 400 });
        }

        // Create comprehensive audit trail entry for workflow action
        const auditTrailEntry = {
            action: action.toLowerCase(),
            actor: user.name || user.email || 'System',
            actorId: String(user.id),
            actorRole: userRole,
            timestamp: new Date(),
            previousStatus: previousStatus,
            newStatus: nextStatus,
            notes: comments || `Workflow action: ${action}`,
            ipAddress: ipAddress,
            userAgent: userAgent
        };

        const updatedInvoice = await db.saveInvoice(id, {
            ...timestampUpdates,
            ...approvalUpdates,
            status: nextStatus,
            auditTrailEntry: auditTrailEntry,
            updatedAt: new Date().toISOString()
        });

        // Trigger notification
        await sendStatusNotification(updatedInvoice, nextStatus);

        return NextResponse.json({
            message: `Invoice moved to ${nextStatus}`,
            invoice: updatedInvoice
        });

    } catch (error) {
        console.error('Workflow error:', error);
        return NextResponse.json({ error: 'Workflow transition failed' }, { status: 500 });
    }

}
