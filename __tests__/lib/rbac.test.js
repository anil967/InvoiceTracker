/**
 * Unit Tests for RBAC Logic
 * Tests lib/rbac.js functions for role-based access control
 */

import { describe, test, expect } from '@jest/globals';
import {
    requireRole,
    checkPermission,
    getVisibleFields,
    filterFields,
    canAccessRoute,
    getAllowedInvoiceActions
} from '@/lib/rbac';
import { ROLES } from '@/constants/roles';

describe('RBAC - requireRole', () => {
    test('should allow Admin for all roles', () => {
        const adminUser = { id: '1', role: ROLES.ADMIN, isActive: true };
        const check = requireRole([ROLES.ADMIN, ROLES.PROJECT_MANAGER]);
        expect(check(adminUser).allowed).toBe(true);
    });

    test('should allow PM for PM-only roles', () => {
        const pmUser = { id: '2', role: ROLES.PROJECT_MANAGER, isActive: true };
        const check = requireRole([ROLES.PROJECT_MANAGER]);
        expect(check(pmUser).allowed).toBe(true);
    });

    test('should deny Vendor access to Admin routes', () => {
        const vendorUser = { id: '3', role: ROLES.VENDOR, isActive: true };
        const check = requireRole([ROLES.ADMIN]);
        expect(check(vendorUser).allowed).toBe(false);
        expect(check(vendorUser).reason).toContain('not authorized');
    });

    test('should deny Finance User access to PM-only routes', () => {
        const financeUser = { id: '4', role: ROLES.FINANCE_USER, isActive: true };
        const check = requireRole([ROLES.PROJECT_MANAGER]);
        expect(check(financeUser).allowed).toBe(false);
    });

    test('should allow Finance User access to Finance routes', () => {
        const financeUser = { id: '4', role: ROLES.FINANCE_USER, isActive: true };
        const check = requireRole([ROLES.FINANCE_USER, ROLES.ADMIN]);
        expect(check(financeUser).allowed).toBe(true);
    });
});

describe('RBAC - checkPermission', () => {
    test('Admin should have all permissions', () => {
        const adminUser = { id: '1', role: ROLES.ADMIN, isActive: true };
        expect(checkPermission(adminUser, 'APPROVE_INVOICE')).toBe(true);
        expect(checkPermission(adminUser, 'MANAGE_USERS')).toBe(true);
        expect(checkPermission(adminUser, 'VIEW_AUDIT_LOGS')).toBe(true);
    });

    test('PM should be able to approve assigned project invoices', () => {
        const pmUser = {
            id: '2',
            role: ROLES.PROJECT_MANAGER,
            assignedProjects: ['project-1', 'project-2'],
            isActive: true
        };
        const invoice = { project: 'project-1' };
        expect(checkPermission(pmUser, 'APPROVE_INVOICE', invoice)).toBe(true);
    });

    test('PM should NOT approve unassigned project invoices', () => {
        const pmUser = {
            id: '2',
            role: ROLES.PROJECT_MANAGER,
            assignedProjects: ['project-1'],
            isActive: true
        };
        const invoice = { project: 'project-3' };
        expect(checkPermission(pmUser, 'APPROVE_INVOICE', invoice)).toBe(false);
    });

    test('Vendor should be able to submit invoices', () => {
        const vendorUser = { id: '3', role: ROLES.VENDOR, isActive: true };
        expect(checkPermission(vendorUser, 'SUBMIT_INVOICE')).toBe(true);
    });

    test('Vendor should NOT manage users', () => {
        const vendorUser = { id: '3', role: ROLES.VENDOR, isActive: true };
        expect(checkPermission(vendorUser, 'MANAGE_USERS')).toBe(false);
    });

    test('Finance User should be able to perform HIL review', () => {
        const financeUser = { id: '4', role: ROLES.FINANCE_USER, isActive: true };
        expect(checkPermission(financeUser, 'HIL_REVIEW')).toBe(true);
    });

    test('Finance User should be able to finalize payment', () => {
        const financeUser = { id: '4', role: ROLES.FINANCE_USER, isActive: true };
        expect(checkPermission(financeUser, 'PAYMENT_RELEASE')).toBe(true);
    });
});

describe('RBAC - getVisibleFields', () => {
    test('Admin should see all invoice fields', () => {
        const fields = getVisibleFields(ROLES.ADMIN, 'invoice');
        expect(fields).toContain('*');
    });

    test('Vendor should see limited invoice fields', () => {
        const fields = getVisibleFields(ROLES.VENDOR, 'invoice');
        expect(fields).toContain('status');
        expect(fields).toContain('amount');
        expect(fields).not.toContain('financeApproval');
    });

    test('PM should see project-relevant fields', () => {
        const fields = getVisibleFields(ROLES.PROJECT_MANAGER, 'invoice');
        expect(fields).toContain('pmApproval');
        expect(fields).toContain('project');
    });
});

describe('RBAC - canAccessRoute', () => {
    test('Admin should access /admin routes', () => {
        const adminUser = { id: '1', role: ROLES.ADMIN, isActive: true };
        expect(canAccessRoute(adminUser, '/admin/users')).toBe(true);
        expect(canAccessRoute(adminUser, '/admin/ratecards')).toBe(true);
    });

    test('PM should access /pm routes', () => {
        const pmUser = { id: '2', role: ROLES.PROJECT_MANAGER, isActive: true };
        expect(canAccessRoute(pmUser, '/pm/documents')).toBe(true);
        expect(canAccessRoute(pmUser, '/pm/approvals')).toBe(true);
    });

    test('PM should NOT access /admin routes', () => {
        const pmUser = { id: '2', role: ROLES.PROJECT_MANAGER, isActive: true };
        expect(canAccessRoute(pmUser, '/admin/users')).toBe(false);
    });

    test('Vendor should access /vendor routes', () => {
        const vendorUser = { id: '3', role: ROLES.VENDOR, isActive: true };
        expect(canAccessRoute(vendorUser, '/vendor/submit')).toBe(true);
        expect(canAccessRoute(vendorUser, '/vendor/invoices')).toBe(true);
    });

    test('Vendor should NOT access /finance routes', () => {
        const vendorUser = { id: '3', role: ROLES.VENDOR, isActive: true };
        expect(canAccessRoute(vendorUser, '/finance/hil-review')).toBe(false);
    });

    test('Finance User should access /finance routes', () => {
        const financeUser = { id: '4', role: ROLES.FINANCE_USER, isActive: true };
        expect(canAccessRoute(financeUser, '/finance/hil-review')).toBe(true);
        expect(canAccessRoute(financeUser, '/finance/approval-queue')).toBe(true);
    });
});

describe('RBAC - getAllowedInvoiceActions', () => {
    test('Admin should have all invoice actions', () => {
        const adminUser = { id: '1', role: ROLES.ADMIN, isActive: true };
        const invoice = { status: 'Pending' };
        const actions = getAllowedInvoiceActions(adminUser, invoice);
        expect(actions).toContain('VIEW');
        expect(actions).toContain('APPROVE');
        expect(actions).toContain('REJECT');
        expect(actions).toContain('EDIT');
    });

    test('PM should have approve/reject for assigned projects', () => {
        const pmUser = {
            id: '2',
            role: ROLES.PROJECT_MANAGER,
            assignedProjects: ['project-1'],
            isActive: true
        };
        const invoice = { status: 'Pending', project: 'project-1' };
        const actions = getAllowedInvoiceActions(pmUser, invoice);
        expect(actions).toContain('VIEW');
        expect(actions).toContain('APPROVE');
        expect(actions).toContain('REJECT');
        expect(actions).not.toContain('EDIT');
    });

    test('Vendor should only VIEW own invoices', () => {
        const vendorUser = { id: '3', role: ROLES.VENDOR, isActive: true };
        const invoice = { status: 'Pending', submittedByUserId: '3' };
        const actions = getAllowedInvoiceActions(vendorUser, invoice);
        expect(actions).toContain('VIEW');
        expect(actions).not.toContain('APPROVE');
        expect(actions).not.toContain('REJECT');
    });

    test('Finance User should have approve for HIL-reviewed invoices', () => {
        const financeUser = { id: '4', role: ROLES.FINANCE_USER, isActive: true };
        const invoice = {
            status: 'PM Approved',
            hilReview: { status: 'REVIEWED' }
        };
        const actions = getAllowedInvoiceActions(financeUser, invoice);
        expect(actions).toContain('VIEW');
        expect(actions).toContain('FINAL_APPROVE');
        expect(actions).toContain('FINAL_REJECT');
    });
});
