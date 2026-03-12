/**
 * Centralized RBAC Utility
 * Provides permission checking, role validation, and field-level access control
 */

import { ROLES, MENU_PERMISSIONS, getNormalizedRole } from '@/constants/roles';

// Re-export getNormalizedRole so routes can import from either '@/lib/rbac' or '@/constants/roles'
export { getNormalizedRole };

/**
 * Check if user has a specific permission for an action on a resource
 * @param {Object} user - User object with role and permissions
 * @param {string} action - Action to check
 * @param {Object} resource - Optional resource for context
 * @returns {boolean}
 */
export const checkPermission = (user, action, resource = null) => {
    if (!user) return false;

    const role = getNormalizedRole(user);

    // Upload documents: PM, Dept Head, Div Head can upload
    if (action === 'UPLOAD_DOCUMENT') {
        return [ROLES.PROJECT_MANAGER, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD].includes(role);
    }

    // Admin has all other permissions
    if (role === ROLES.ADMIN) return true;

    // Check granular permission overrides
    if (user.permissions?.includes(action)) return true;

    switch (action) {
        // Admin only
        case 'CONFIGURE_SYSTEM':
        case 'MANAGE_USERS':
        case 'MANAGE_RATE_CARDS':
        case 'VIEW_ALL_AUDIT_LOGS':
        case 'BACKUP_RESTORE':
            return false;

        // Finance User permissions
        case 'HIL_REVIEW':
        case 'PROCESS_DISCREPANCIES':
        case 'MANUAL_ENTRY':
            return role === ROLES.FINANCE_USER;

        case 'FINAL_APPROVAL':
        case 'PAYMENT_RELEASE':
            return role === ROLES.FINANCE_USER;

        // PM permissions (scoped)
        case 'APPROVE_INVOICE':
            if (role === ROLES.PROJECT_MANAGER) {
                // Allow if PM is directly assigned to this invoice
                if (resource?.assignedPM === user.id) return true;
                // Allow if invoice project is in PM's assigned projects
                if (resource?.project) {
                    return user.assignedProjects?.includes(resource.project);
                }
                return true; // General capability check
            }
            return role === ROLES.FINANCE_USER;

        case 'UPLOAD_DOCUMENT':
            return [ROLES.PROJECT_MANAGER, ROLES.FINANCE_USER].includes(role);

        case 'VALIDATE_TIMESHEET':
            return role === ROLES.PROJECT_MANAGER;

        // Vendor permissions
        case 'SUBMIT_INVOICE':
            return [ROLES.VENDOR, ROLES.FINANCE_USER].includes(role);

        case 'VIEW_OWN_INVOICES':
            return role === ROLES.VENDOR;

        // General access
        case 'VIEW_INVOICES':
            return [ROLES.ADMIN, ROLES.FINANCE_USER, ROLES.PROJECT_MANAGER, ROLES.VENDOR, ROLES.DEPT_HEAD, ROLES.DIV_HEAD].includes(role);

        case 'VIEW_ANALYTICS':
            return [ROLES.ADMIN, ROLES.FINANCE_USER, ROLES.DEPT_HEAD, ROLES.DIV_HEAD].includes(role);

        case 'VIEW_VENDORS':
            return [ROLES.ADMIN, ROLES.FINANCE_USER, ROLES.VENDOR, ROLES.DEPT_HEAD, ROLES.DIV_HEAD].includes(role);

        default:
            return false;
    }
};

/**
 * Middleware helper to require specific roles
 * @param {string[]} allowedRoles - Array of allowed role strings
 * @returns {Function} - Middleware function
 */
export const requireRole = (allowedRoles) => {
    return (user) => {
        if (!user) return { allowed: false, reason: 'Not authenticated' };
        // Only block if explicitly deactivated; treat undefined as active
        // (old session tokens may not carry isActive)
        if (user.isActive === false) return { allowed: false, reason: 'User account is deactivated' };

        const userRole = getNormalizedRole(user);

        if (allowedRoles.includes(userRole)) {
            return { allowed: true };
        }

        return { allowed: false, reason: `Role ${userRole} not authorized for this action` };
    };
};

/**
 * Get visible fields for a role on a specific resource type
 * @param {string} role - User role
 * @param {string} resourceType - Type of resource (invoice, vendor, user, etc.)
 * @returns {string[]} - Array of visible field names
 */
export const getVisibleFields = (role, resourceType) => {
    const fieldMap = {
        invoice: {
            [ROLES.ADMIN]: ['*'], // All fields
            [ROLES.FINANCE_USER]: ['*'],
            [ROLES.PROJECT_MANAGER]: [
                'id', 'vendorName', 'invoiceNumber', 'date', 'amount', 'status',
                'project', 'poNumber', 'pmApproval', 'documents', 'created_at'
            ],
            [ROLES.VENDOR]: [
                'id', 'invoiceNumber', 'date', 'amount', 'status', 'created_at'
            ]
        },
        vendor: {
            [ROLES.ADMIN]: ['*'],
            [ROLES.FINANCE_USER]: ['*'],
            [ROLES.PROJECT_MANAGER]: ['id', 'name', 'email', 'phone'],
            [ROLES.VENDOR]: ['id', 'name', 'email', 'phone', 'address', 'bankDetails']
        },
        user: {
            [ROLES.ADMIN]: ['*'],
            [ROLES.FINANCE_USER]: ['id', 'name', 'email', 'role'],
            [ROLES.PROJECT_MANAGER]: ['id', 'name', 'email'],
            [ROLES.VENDOR]: [] // No access to other users
        }
    };

    return fieldMap[resourceType]?.[role] || [];
};

/**
 * Filter object to only include visible fields
 * @param {Object} obj - Object to filter
 * @param {string} role - User role
 * @param {string} resourceType - Type of resource
 * @returns {Object} - Filtered object
 */
export const filterFields = (obj, role, resourceType) => {
    const visibleFields = getVisibleFields(role, resourceType);

    if (visibleFields.includes('*')) return obj;
    if (visibleFields.length === 0) return {};

    return Object.keys(obj)
        .filter(key => visibleFields.includes(key))
        .reduce((filtered, key) => {
            filtered[key] = obj[key];
            return filtered;
        }, {});
};

/**
 * Check if user can access a specific route
 * @param {Object} user - User object
 * @param {string} pathname - Route pathname
 * @returns {boolean}
 */
export const canAccessRoute = (user, pathname) => {
    if (!user) return false;
    // Only block if explicitly deactivated; treat undefined as active
    if (user.isActive === false) return false;
    const role = getNormalizedRole(user);
    if (role === ROLES.ADMIN) return true;

    const routePermissions = {
        '/admin': [ROLES.ADMIN],
        '/admin/users': [ROLES.ADMIN],
        '/admin/ratecards': [ROLES.ADMIN],
        '/admin/projects': [ROLES.ADMIN],
        '/admin/messages': [ROLES.ADMIN],
        '/finance': [ROLES.ADMIN],
        '/finance/hil-review': [ROLES.ADMIN],
        '/finance/approval-queue': [ROLES.ADMIN],
        '/finance/dashboard': [ROLES.ADMIN],
        '/finance/manual-entry': [ROLES.ADMIN],
        '/dept-head': [ROLES.ADMIN, ROLES.DEPARTMENT_HEAD],
        '/dept-head/dashboard': [ROLES.ADMIN, ROLES.DEPARTMENT_HEAD],
        '/dept-head/approval-queue': [ROLES.ADMIN, ROLES.DEPARTMENT_HEAD],
        '/div-head': [ROLES.ADMIN, ROLES.DIVISIONAL_HEAD],
        '/div-head/dashboard': [ROLES.ADMIN, ROLES.DIVISIONAL_HEAD],
        '/div-head/approval-queue': [ROLES.ADMIN, ROLES.DIVISIONAL_HEAD],
        '/pm': [ROLES.ADMIN, ROLES.PROJECT_MANAGER],
        '/pm/documents': [ROLES.PROJECT_MANAGER, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD],
        '/pm/approvals': [ROLES.PROJECT_MANAGER],
        '/pm/messages': [ROLES.PROJECT_MANAGER, ROLES.VENDOR, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD],
        '/vendor': [ROLES.VENDOR],
        '/vendor/submit': [ROLES.VENDOR],
        '/vendor/ratecards': [ROLES.VENDOR],
        '/vendor/invoices': [ROLES.VENDOR],
        '/vendors': [ROLES.ADMIN, ROLES.VENDOR],
        '/dashboard': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.VENDOR, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD],
        '/digitization': [ROLES.ADMIN],
        '/approvals': [ROLES.ADMIN, ROLES.PROJECT_MANAGER],
        '/audit': [ROLES.ADMIN],
        '/config': [ROLES.ADMIN],
        '/users': [ROLES.ADMIN]
    };

    // Sort routes by length descending to match specific paths first
    const sortedRoutes = Object.entries(routePermissions).sort((a, b) => b[0].length - a[0].length);

    // Find matching route
    for (const [route, roles] of sortedRoutes) {
        if (pathname === route || pathname.startsWith(route + '/')) {
            return roles.includes(role);
        }
    }

    // Default allow
    return true;
};

/**
 * Get allowed actions for a user on a specific invoice
 * @param {Object} user - User object
 * @param {Object} invoice - Invoice object
 * @returns {string[]} - Array of allowed action names
 */
export const getAllowedInvoiceActions = (user, invoice) => {
    if (!user) return [];

    const actions = [];
    const role = getNormalizedRole(user);

    // View is always allowed if you can see the invoice
    actions.push('VIEW');

    if (role === ROLES.ADMIN) {
        actions.push('EDIT', 'DELETE', 'APPROVE', 'REJECT', 'ASSIGN_PM');
    }

    if (role === ROLES.FINANCE_USER) {
        actions.push('EDIT', 'HIL_REVIEW', 'FINAL_APPROVE', 'FINAL_REJECT');
    }

    if (role === ROLES.PROJECT_MANAGER) {
        // Allow actions if PM is directly assigned OR project matches
        if (invoice.assignedPM === user.id || user.assignedProjects?.includes(invoice.project)) {
            actions.push('APPROVE', 'REJECT', 'REQUEST_INFO');
        }
    }

    if (role === ROLES.VENDOR && invoice.submittedByUserId === user.id) {
        // Vendors can only view their own invoices
        // No edit actions after submission
    }

    return actions;
};
