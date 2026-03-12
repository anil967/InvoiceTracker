// lib/invoice-workflow.js - Invoice workflow state machine
import { ROLES } from '@/constants/roles';

/**
 * Invoice Workflow Status Constants
 * Using constants to ensure consistency across the application
 */
export const INVOICE_STATUS = {
    SUBMITTED: 'Submitted',
    PENDING_PM_APPROVAL: 'Pending PM Approval',
    // New two-tier approval chain: Dept Head → Div Head
    PENDING_DEPT_HEAD_REVIEW: 'Pending Dept Head Review',
    DEPT_HEAD_REJECTED: 'Dept Head Rejected',
    PENDING_DIV_HEAD_REVIEW: 'Pending Div Head Review',
    DIV_HEAD_APPROVED: 'Div Head Approved',
    DIV_HEAD_REJECTED: 'Div Head Rejected',
    // Legacy finance user statuses (kept for backward compatibility)
    PENDING_FINANCE_REVIEW: 'Pending Finance Review',
    MORE_INFO_NEEDED: 'More Info Needed',
    PM_REJECTED: 'PM Rejected',
    FINANCE_REJECTED: 'Finance Rejected',
    FINANCE_APPROVED: 'Finance Approved'
};

/**
 * Complete workflow state machine definition
 * Maps each allowed transition from currentStatus to [newStatuses]
 * with optional role restrictions
 */
export const WORKFLOW_TRANSITIONS = {
    // Vendor submits invoice → automatically goes to PM review
    [INVOICE_STATUS.SUBMITTED]: [
        INVOICE_STATUS.PENDING_PM_APPROVAL,
        INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW,
        INVOICE_STATUS.PENDING_FINANCE_REVIEW,
        INVOICE_STATUS.PM_REJECTED,
        INVOICE_STATUS.MORE_INFO_NEEDED
    ],

    // PM reviews invoice
    [INVOICE_STATUS.PENDING_PM_APPROVAL]: [
        INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW,  // PM approves → Dept Head
        INVOICE_STATUS.PENDING_FINANCE_REVIEW,     // PM approves → Legacy Finance (backward compat)
        INVOICE_STATUS.PM_REJECTED,                // PM rejects
        INVOICE_STATUS.MORE_INFO_NEEDED            // PM needs more info
    ],

    // Department Head reviews invoice (after PM approves)
    [INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW]: [
        INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW,   // Dept Head approves → Div Head
        INVOICE_STATUS.DEPT_HEAD_REJECTED,         // Dept Head rejects
        INVOICE_STATUS.MORE_INFO_NEEDED            // Dept Head needs more info
    ],

    // Divisional Head reviews invoice (after Dept Head approves) — FINAL layer
    [INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW]: [
        INVOICE_STATUS.DIV_HEAD_APPROVED,          // Div Head final approves
        INVOICE_STATUS.DIV_HEAD_REJECTED,          // Div Head rejects
        INVOICE_STATUS.MORE_INFO_NEEDED            // Div Head needs more info
    ],

    // Legacy Finance reviews invoice (only after PM approves – old workflow)
    [INVOICE_STATUS.PENDING_FINANCE_REVIEW]: [
        INVOICE_STATUS.FINANCE_APPROVED,           // Finance approves (final)
        INVOICE_STATUS.FINANCE_REJECTED,           // Finance rejects
        INVOICE_STATUS.MORE_INFO_NEEDED            // Finance needs more info
    ],

    // Vendor provides requested information → returns to appropriate review stage
    [INVOICE_STATUS.MORE_INFO_NEEDED]: [
        INVOICE_STATUS.PENDING_PM_APPROVAL,        // Info submitted to PM
        INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW,   // Info submitted to Dept Head
        INVOICE_STATUS.PENDING_FINANCE_REVIEW,     // Info submitted to Finance (legacy)
        INVOICE_STATUS.PM_REJECTED,                // PM rejects after re-check
        INVOICE_STATUS.MORE_INFO_NEEDED            // PM re-requests info again
    ],

    // Terminal states - no further transitions
    [INVOICE_STATUS.PM_REJECTED]: [],
    [INVOICE_STATUS.DEPT_HEAD_REJECTED]: [],
    [INVOICE_STATUS.DIV_HEAD_REJECTED]: [],
    [INVOICE_STATUS.DIV_HEAD_APPROVED]: [],
    [INVOICE_STATUS.FINANCE_REJECTED]: [],
    [INVOICE_STATUS.FINANCE_APPROVED]: []
};

/**
 * Role-specific state transition permissions
 * Determines which roles can initiate which transitions
 */
export const TRANSITION_PERMISSIONS = {
    // Vendors can only transition from 'More Info Needed' back to review stage
    [ROLES.VENDOR]: {
        [INVOICE_STATUS.MORE_INFO_NEEDED]: [
            INVOICE_STATUS.PENDING_PM_APPROVAL,
            INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW,
            INVOICE_STATUS.PENDING_FINANCE_REVIEW
        ]
    },

    // PMs, Dept Heads, and Div Heads can only transition from their review stage
    [ROLES.PROJECT_MANAGER]: {
        [INVOICE_STATUS.SUBMITTED]: [
            INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW,
            INVOICE_STATUS.PENDING_FINANCE_REVIEW,
            INVOICE_STATUS.PM_REJECTED,
            INVOICE_STATUS.MORE_INFO_NEEDED
        ],
        [INVOICE_STATUS.PENDING_PM_APPROVAL]: [
            INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW,
            INVOICE_STATUS.PENDING_FINANCE_REVIEW,
            INVOICE_STATUS.PM_REJECTED,
            INVOICE_STATUS.MORE_INFO_NEEDED
        ],
        [INVOICE_STATUS.MORE_INFO_NEEDED]: [
            INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW,
            INVOICE_STATUS.PENDING_FINANCE_REVIEW,
            INVOICE_STATUS.PM_REJECTED,
            INVOICE_STATUS.MORE_INFO_NEEDED
        ]
    },
    [ROLES.DEPT_HEAD]: {
        [INVOICE_STATUS.SUBMITTED]: [
            INVOICE_STATUS.PENDING_FINANCE_REVIEW,
            INVOICE_STATUS.PM_REJECTED,
            INVOICE_STATUS.MORE_INFO_NEEDED
        ],
        [INVOICE_STATUS.PENDING_PM_APPROVAL]: [
            INVOICE_STATUS.PENDING_FINANCE_REVIEW,
            INVOICE_STATUS.PM_REJECTED,
            INVOICE_STATUS.MORE_INFO_NEEDED
        ]
    },
    [ROLES.DIV_HEAD]: {
        [INVOICE_STATUS.SUBMITTED]: [
            INVOICE_STATUS.PENDING_FINANCE_REVIEW,
            INVOICE_STATUS.PM_REJECTED,
            INVOICE_STATUS.MORE_INFO_NEEDED
        ],
        [INVOICE_STATUS.PENDING_PM_APPROVAL]: [
            INVOICE_STATUS.PENDING_FINANCE_REVIEW,
            INVOICE_STATUS.PM_REJECTED,
            INVOICE_STATUS.MORE_INFO_NEEDED
        ]
    },

    // Department Head: first FU-level approval
    [ROLES.DEPARTMENT_HEAD]: {
        [INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW]: [
            INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW,
            INVOICE_STATUS.DEPT_HEAD_REJECTED,
            INVOICE_STATUS.MORE_INFO_NEEDED
        ]
    },

    // Divisional Head: final FU-level approval
    [ROLES.DIVISIONAL_HEAD]: {
        [INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW]: [
            INVOICE_STATUS.DIV_HEAD_APPROVED,
            INVOICE_STATUS.DIV_HEAD_REJECTED,
            INVOICE_STATUS.MORE_INFO_NEEDED
        ]
    },

    // Legacy Finance users can only transition from their review stage
    [ROLES.FINANCE_USER]: {
        [INVOICE_STATUS.PENDING_FINANCE_REVIEW]: [
            INVOICE_STATUS.FINANCE_APPROVED,
            INVOICE_STATUS.FINANCE_REJECTED,
            INVOICE_STATUS.MORE_INFO_NEEDED
        ]
    },

    // Admins can perform any transition
    [ROLES.ADMIN]: null // null means no restrictions
};

/**
 * Workflow stage descriptions for UI display
 */
export const WORKFLOW_STAGE_DESCRIPTIONS = {
    [INVOICE_STATUS.SUBMITTED]: {
        title: 'Invoice Submitted',
        description: 'Invoice has been submitted and is awaiting PM assignment',
        next_stage: 'Pending PM Approval'
    },
    [INVOICE_STATUS.PENDING_PM_APPROVAL]: {
        title: 'Pending PM Approval',
        description: 'Invoice is assigned to Project Manager for review',
        next_stage: 'Pending Dept Head Review'
    },
    [INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW]: {
        title: 'Pending Department Head Review',
        description: 'Invoice has been approved by PM and is pending Department Head approval',
        next_stage: 'Pending Div Head Review'
    },
    [INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW]: {
        title: 'Pending Divisional Head Review',
        description: 'Invoice has been approved by Department Head and is pending final Divisional Head approval',
        next_stage: 'Div Head Approved'
    },
    [INVOICE_STATUS.DIV_HEAD_APPROVED]: {
        title: 'Final Approved',
        description: 'Invoice has been finally approved by the Divisional Head',
        next_stage: null
    },
    [INVOICE_STATUS.PENDING_FINANCE_REVIEW]: {
        title: 'Pending Finance Review',
        description: 'Invoice has been approved by PM and is pending Finance approval (legacy)',
        next_stage: 'Finance Approved'
    },
    [INVOICE_STATUS.MORE_INFO_NEEDED]: {
        title: 'More Information Required',
        description: 'Additional information has been requested. Please provide details.',
        next_stage: null
    },
    [INVOICE_STATUS.PM_REJECTED]: {
        title: 'PM Rejected',
        description: 'Invoice has been rejected by Project Manager',
        next_stage: null
    },
    [INVOICE_STATUS.DEPT_HEAD_REJECTED]: {
        title: 'Department Head Rejected',
        description: 'Invoice has been rejected by Department Head',
        next_stage: null
    },
    [INVOICE_STATUS.DIV_HEAD_REJECTED]: {
        title: 'Divisional Head Rejected',
        description: 'Invoice has been rejected by Divisional Head',
        next_stage: null
    },
    [INVOICE_STATUS.FINANCE_REJECTED]: {
        title: 'Finance Rejected',
        description: 'Invoice has been rejected by Finance (legacy)',
        next_stage: null
    },
    [INVOICE_STATUS.FINANCE_APPROVED]: {
        title: 'Finance Approved',
        description: 'Invoice has been approved by Finance (legacy)',
        next_stage: null
    }
};

/**
 * Terminal states that indicate workflow completion
 */
export const TERMINAL_STATUSES = [
    INVOICE_STATUS.PM_REJECTED,
    INVOICE_STATUS.DEPT_HEAD_REJECTED,
    INVOICE_STATUS.DIV_HEAD_REJECTED,
    INVOICE_STATUS.DIV_HEAD_APPROVED,
    INVOICE_STATUS.FINANCE_REJECTED,
    INVOICE_STATUS.FINANCE_APPROVED
];

/**
 * Review stages that require action
 */
export const REVIEW_STATUSES = [
    INVOICE_STATUS.PENDING_PM_APPROVAL,
    INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW,
    INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW,
    INVOICE_STATUS.PENDING_FINANCE_REVIEW,
    INVOICE_STATUS.MORE_INFO_NEEDED
];

/**
 * Validate if a status transition is allowed
 */
export function validateTransition(currentStatus, newStatus, role = null) {
    // Check if current status is valid
    if (!currentStatus || !WORKFLOW_TRANSITIONS.hasOwnProperty(currentStatus)) {
        return {
            allowed: false,
            reason: `Invalid current status: ${currentStatus}`
        };
    }

    // Check if new status is valid
    if (!newStatus || !Object.values(INVOICE_STATUS).includes(newStatus)) {
        return {
            allowed: false,
            reason: `Invalid target status: ${newStatus}`
        };
    }

    // Check if transition exists in workflow
    const allowedTransitions = WORKFLOW_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
        return {
            allowed: false,
            reason: `Invalid transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`
        };
    }

    // Check role-based permissions if role is provided
    if (role && role !== ROLES.ADMIN) {
        const rolePermissions = TRANSITION_PERMISSIONS[role];
        if (rolePermissions !== null) {
            const roleAllowedTransitions = rolePermissions[currentStatus];
            if (!roleAllowedTransitions || !roleAllowedTransitions.includes(newStatus)) {
                return {
                    allowed: false,
                    reason: `${role} role is not authorized to perform transition from ${currentStatus} to ${newStatus}`
                };
            }
        }
    }

    return { allowed: true };
}

/**
 * Get allowed transitions for a given status and role
 */
export function getAllowedTransitions(currentStatus, role) {
    const transitions = WORKFLOW_TRANSITIONS[currentStatus] || [];

    // If admin, return all transitions
    if (role === ROLES.ADMIN) {
        return transitions;
    }

    // Filter transitions based on role permissions
    const rolePermissions = TRANSITION_PERMISSIONS[role];
    if (rolePermissions === null) {
        return transitions;
    }

    const roleAllowed = rolePermissions[currentStatus] || [];
    return transitions.filter(status => roleAllowed.includes(status));
}

/**
 * Determine the appropriate review stage after info is submitted
 */
export function determineInfoReturnDestination(invoice) {
    // Check if Divisional Head requested info
    if (invoice.divHeadApproval?.status === 'INFO_REQUESTED') {
        return INVOICE_STATUS.PENDING_DIV_HEAD_REVIEW;
    }

    // Check if Dept Head requested info
    if (invoice.deptHeadApproval?.status === 'INFO_REQUESTED') {
        return INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW;
    }

    // Check if Finance requested info (legacy)
    if (invoice.financeApproval?.status === 'INFO_REQUESTED') {
        return INVOICE_STATUS.PENDING_FINANCE_REVIEW;
    }

    // Default to PM if PM requested info or if unsure
    if (invoice.pmApproval?.status === 'INFO_REQUESTED' || !invoice.pmApproval || invoice.pmApproval.status === 'PENDING') {
        return INVOICE_STATUS.PENDING_PM_APPROVAL;
    }

    // If PM approved but nobody reviewed yet, go to Dept Head (new flow)
    if (invoice.pmApproval?.status === 'APPROVED') {
        return INVOICE_STATUS.PENDING_DEPT_HEAD_REVIEW;
    }

    // Default to PM
    return INVOICE_STATUS.PENDING_PM_APPROVAL;
}

/**
 * Check if a status is a terminal state (workflow complete)
 */
export function isTerminalStatus(status) {
    return TERMINAL_STATUSES.includes(status);
}

/**
 * Check if a status requires review action
 */
export function isReviewStatus(status) {
    return REVIEW_STATUSES.includes(status);
}

/**
 * Get the next expected stage in the workflow
 */
export function getNextStage(status) {
    const stage = WORKFLOW_STAGE_DESCRIPTIONS[status];
    return stage ? stage.next_stage : null;
}

/**
 * Get detailed stage information
 */
export function getStageInfo(status) {
    return WORKFLOW_STAGE_DESCRIPTIONS[status] || null;
}

/**
 * Generate audit log message for a transition
 */
export function generateAuditMessage(action, role, invoiceNumber, oldStatus, newStatus, notes = null) {
    const actionText = action.toLowerCase().replace('_', ' ');
    const baseMessage = `${role} ${actionText} invoice #${invoiceNumber}. Status changed from ${oldStatus} to ${newStatus}`;
    return notes ? `${baseMessage}. Notes: ${notes}` : baseMessage;
}
