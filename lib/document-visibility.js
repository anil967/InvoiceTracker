import { ROLES } from '@/constants/roles';

/**
 * Role hierarchy: Admin > Divisional Head > Department Head > Project Manager > Vendor
 * Documents flow UP the hierarchy - higher roles can see documents uploaded by lower roles
 */

/**
 * Map of roles to the minimum role that can view their documents
 * e.g., PM documents can be viewed by PM, DeptHead, DivHead, Admin
 */
const ROLE_VISIBILITY_MAP = {
    [ROLES.VENDOR]: [ROLES.VENDOR, ROLES.PROJECT_MANAGER, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD, ROLES.ADMIN],
    [ROLES.PROJECT_MANAGER]: [ROLES.PROJECT_MANAGER, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD, ROLES.ADMIN],
    [ROLES.DEPARTMENT_HEAD]: [ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD, ROLES.ADMIN],
    [ROLES.DIVISIONAL_HEAD]: [ROLES.DIVISIONAL_HEAD, ROLES.ADMIN],
    [ROLES.ADMIN]: [ROLES.ADMIN],
    [ROLES.FINANCE_USER]: [ROLES.FINANCE_USER, ROLES.ADMIN], // Finance users have special handling
};

/**
 * Get the hierarchy level of a role
 * Higher numbers = more privileges
 */
function getRoleLevel(role) {
    const levels = {
        [ROLES.VENDOR]: 0,
        [ROLES.PROJECT_MANAGER]: 1,
        [ROLES.DEPARTMENT_HEAD]: 2,
        [ROLES.DIVISIONAL_HEAD]: 3,
        [ROLES.ADMIN]: 4,
        [ROLES.FINANCE_USER]: 1, // Treat Finance User similar to PM for visibility
    };
    return levels[role] ?? -1;
}

/**
 * Check if a viewer role can see documents uploaded by a specific uploader role
 * @param {string} uploaderRole - The role of the user who uploaded the document
 * @param {string} viewerRole - The role of the user viewing the document
 * @returns {boolean} - Whether the viewer can see the document
 */
export function canViewDocument(uploaderRole, viewerRole) {
    if (!uploaderRole || !viewerRole) {
        return false;
    }

    // Admin can see all documents
    if (viewerRole === ROLES.ADMIN) {
        return true;
    }

    // Finance User can only see their own documents (or documents shared with them specifically)
    if (viewerRole === ROLES.FINANCE_USER) {
        return uploaderRole === ROLES.FINANCE_USER;
    }

    // Check the visibility map
    const allowedViewers = ROLE_VISIBILITY_MAP[uploaderRole];
    if (allowedViewers) {
        return allowedViewers.includes(viewerRole);
    }

    // Fallback: use role level comparison
    const uploaderLevel = getRoleLevel(uploaderRole);
    const viewerLevel = getRoleLevel(viewerRole);
    
    // Viewer can see if they are at or above the uploader's level
    return viewerLevel >= uploaderLevel && viewerRole !== ROLES.VENDOR;
}

/**
 * Build a MongoDB query filter for document visibility based on user role
 * @param {string} userRole - The role of the user requesting documents
 * @returns {Object} - MongoDB filter object
 */
export function buildVisibilityQuery(userRole) {
    if (!userRole) {
        return {};
    }

    // Admin sees all documents
    if (userRole === ROLES.ADMIN) {
        return {};
    }

    // Finance User only sees their own documents
    if (userRole === ROLES.FINANCE_USER) {
        return { uploadedByRole: ROLES.FINANCE_USER };
    }

    // For other roles, documents must have been uploaded by this role OR a role below in hierarchy
    // Vendor: only documents with uploadedByRole = Vendor
    // PM: documents with uploadedByRole = Vendor OR PM
    // DeptHead: documents with uploadedByRole = Vendor OR PM OR DeptHead
    // DivHead: documents with uploadedByRole = Vendor OR PM OR DeptHead OR DivHead
    
    const allowedUploaderRoles = [];
    
    // Add the user's own role and all roles below in hierarchy
    if (userRole === ROLES.DIVISIONAL_HEAD) {
        allowedUploaderRoles.push(
            ROLES.VENDOR,
            ROLES.PROJECT_MANAGER,
            ROLES.DEPARTMENT_HEAD,
            ROLES.DIVISIONAL_HEAD
        );
    } else if (userRole === ROLES.DEPARTMENT_HEAD) {
        allowedUploaderRoles.push(
            ROLES.VENDOR,
            ROLES.PROJECT_MANAGER,
            ROLES.DEPARTMENT_HEAD
        );
    } else if (userRole === ROLES.PROJECT_MANAGER) {
        allowedUploaderRoles.push(
            ROLES.VENDOR,
            ROLES.PROJECT_MANAGER
        );
    } else if (userRole === ROLES.VENDOR) {
        allowedUploaderRoles.push(ROLES.VENDOR);
    }

    if (allowedUploaderRoles.length > 0) {
        return { uploadedByRole: { $in: allowedUploaderRoles } };
    }

    return {};
}

/**
 * Normalizes role string to standard format for consistency
 */
export function normalizeRoleForDocument(role) {
    if (!role) return null;
    
    const normalized = String(role).toLowerCase().trim();
    
    if (normalized.includes('admin')) return ROLES.ADMIN;
    if (normalized.includes('finance') || normalized.includes('fu')) return ROLES.FINANCE_USER;
    if (normalized.includes('divisional') || normalized.includes('div head')) return ROLES.DIVISIONAL_HEAD;
    if (normalized.includes('department') || normalized.includes('dept head')) return ROLES.DEPARTMENT_HEAD;
    if (normalized.includes('project') || normalized.includes('pm')) return ROLES.PROJECT_MANAGER;
    if (normalized.includes('vendor')) return ROLES.VENDOR;
    
    return role; // Return original if no match
}
