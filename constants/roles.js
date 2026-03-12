/**
 * Helper to normalize role strings
 * Handles variations like 'Project Manager' -> 'PM', 'Finance User' -> 'Finance User'
 * Case-insensitive and handles both space and underscore variations
 */
export const getNormalizedRole = (user) => {
    if (!user?.role) return '';

    // Handle array of roles if present
    const roleValue = Array.isArray(user.role) ? user.role[0] : user.role;

    if (typeof roleValue !== 'string') return '';

    const rawRole = roleValue.toLowerCase();

    // Project Manager variations
    if (['projectmanager', 'project manager', 'project-manager', 'pm'].includes(rawRole)) {
        return ROLES.PROJECT_MANAGER;
    }

    // Dept Head variations (e.g., 'Dept Head - Sales', 'Department Head')
    if (rawRole.includes('dept') || rawRole.includes('department')) {
        return ROLES.DEPARTMENT_HEAD;
    }

    // Divisional Head variations
    if (rawRole.includes('divisional') || rawRole.includes('div head') || rawRole.includes('division') || rawRole.startsWith('div.')) {
        return ROLES.DIVISIONAL_HEAD;
    }

    // Finance User variations
    if (['financeuser', 'finance user', 'finance-user', 'finance_user'].includes(rawRole)) {
        return ROLES.FINANCE_USER;
    }

    // Department Head variations
    if (['department head', 'departmenthead', 'department-head', 'dept head', 'depthead', 'dept-head'].includes(rawRole)) {
        return ROLES.DEPARTMENT_HEAD;
    }

    // Divisional Head variations
    if (['divisional head', 'divisionalhead', 'divisional-head', 'div head', 'divhead', 'div-head'].includes(rawRole)) {
        return ROLES.DIVISIONAL_HEAD;
    }

    // Vendor variations
    if (rawRole === 'vendor') {
        return ROLES.VENDOR;
    }

    // Admin variations
    if (rawRole === 'admin') {
        return ROLES.ADMIN;
    }

    return user.role; // Return original if no match
};

/**
 * Check if user has permission for a specific action
 * 
 * Role Hierarchy:
 * - Admin: Full system access (includes audit logs, analytics, system health)
 * - Divisional Head: Final approval layer (FU-level permissions)
 * - Department Head: Mid approval layer (FU-level permissions)
 * - Finance User: Legacy operational role (kept for backward compatibility)
 * - Project Manager: Approves invoices for assigned projects
 * - Vendor: Submits invoices, views own invoices
 */

export const ROLES = {
    ADMIN: 'Admin',
    PROJECT_MANAGER: 'PM',
    FINANCE_USER: 'Finance User',
    DEPARTMENT_HEAD: 'Department Head',
    DIVISIONAL_HEAD: 'Divisional Head',
    VENDOR: 'Vendor',
    // Aliases for backward compatibility and to fix existing references
    DEPT_HEAD: 'Department Head',
    DIV_HEAD: 'Divisional Head'
};

/**
 * Active roles available for new user creation.
 * FINANCE_USER intentionally excluded — removed from active workflow.
 * New flow: Admin → Divisional Head → Department Head → PM → Vendor
 */
export const ROLES_LIST = [
    ROLES.ADMIN,
    ROLES.DIVISIONAL_HEAD,
    ROLES.DEPARTMENT_HEAD,
    ROLES.PROJECT_MANAGER,
    ROLES.VENDOR,
];

export const MENU_PERMISSIONS = {
    'Dashboard': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD, ROLES.VENDOR],
    'Approvals': [ROLES.ADMIN],
    'PM Approval Queue': [ROLES.PROJECT_MANAGER],
    'Messages': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.VENDOR, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD],
    'Dept Head Approval Queue': [ROLES.DEPARTMENT_HEAD, ROLES.DEPT_HEAD],
    'Div Head Approval Queue': [ROLES.DIVISIONAL_HEAD, ROLES.DIV_HEAD],
    'Configuration': [ROLES.ADMIN],
    'User Management': [ROLES.ADMIN],
    'Audit Logs': [ROLES.ADMIN],
    'Rate Cards': [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD, ROLES.VENDOR],
    'Hierarchy': [ROLES.ADMIN],
    'Re-check Requests': [ROLES.VENDOR],
};

/**
 * Check if user has permission for a specific action
 * @param {Object} user - User object with role property
 * @param {string} action - Action to check permission for
 * @returns {boolean} - Whether user has permission
 */
export const hasPermission = (user, action, resource = null) => {
    if (!user) return false;
    const effectiveRole = getNormalizedRole(user);
    if (effectiveRole === ROLES.ADMIN) return true;

    // Active approval-tier roles (Dept Head and Div Head)
    const APPROVAL_ROLES = [ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD];

    switch (action) {
        case 'CONFIGURE_SYSTEM':
        case 'MANAGE_USERS':
            return effectiveRole === ROLES.ADMIN;

        case 'APPROVE_MATCH':
            if (effectiveRole === ROLES.PROJECT_MANAGER) {
                if (resource && resource.project) {
                    return user.assignedProjects?.includes(resource.project);
                }
                return true;
            }
            return APPROVAL_ROLES.includes(effectiveRole);

        case 'FINALIZE_PAYMENT':
            return [ROLES.ADMIN, ...APPROVAL_ROLES].includes(effectiveRole);

        case 'PROCESS_DISCREPANCIES':
            return APPROVAL_ROLES.includes(effectiveRole);

        case 'VIEW_AUDIT_LOGS':
        case 'VIEW_COMPLIANCE':
            return effectiveRole === ROLES.ADMIN;

        case 'SUBMIT_INVOICE':
            return [ROLES.VENDOR].includes(effectiveRole);

        case 'VIEW_ALL_INVOICES':
            return [ROLES.ADMIN, ...APPROVAL_ROLES, ROLES.PROJECT_MANAGER, ROLES.VENDOR].includes(effectiveRole);

        default:
            return false;
    }
};

/**
 * Check if user can see a specific menu item
 * @param {Object} user - User object with role property
 * @param {string} itemName - Menu item name
 * @returns {boolean} - Whether user can see the menu item
 */
export const canSeeMenuItem = (user, itemName) => {
    if (!user) return false;
    const userRole = getNormalizedRole(user);

    const allowedRoles = MENU_PERMISSIONS[itemName];
    if (!allowedRoles) return false; // Hidden if not explicitly allowed

    return allowedRoles.includes(userRole);
};
