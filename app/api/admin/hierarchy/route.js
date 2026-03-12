import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES, getNormalizedRole } from '@/constants/roles';

/**
 * GET /api/admin/hierarchy - Get all users structured as a hierarchy tree
 * Tree: Admin -> Finance User -> PM -> Vendor
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        const allUsers = await db.getAllUsers();

        // Build a tree structure
        // Root: Admin users
        // Children of Admin: Finance Users (managedBy = admin.id)
        // Children of FU: PMs (managedBy = fu.id)
        // Children of PM: Vendors (managedBy = pm.id)

        const userMap = {};
        allUsers.forEach(u => { userMap[u.id] = { ...u, children: [] }; });

        const roots = []; // Admin users (top of the tree)
        const unassigned = []; // Users with no managedBy

        allUsers.forEach(u => {
            const normalizedRole = getNormalizedRole(u) || u.role;

            const node = userMap[u.id];
            node.role = normalizedRole; // Ensure node in tree has normalized role

            if (normalizedRole === ROLES.ADMIN) {
                roots.push(node);
            } else if (u.managedBy && userMap[u.managedBy]) {
                userMap[u.managedBy].children.push(node);
            } else {
                unassigned.push(node);
            }
        });

        return NextResponse.json({
            tree: roots,
            unassigned,
            allUsers: allUsers.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: getNormalizedRole(u) || u.role,
                managedBy: u.managedBy,
                isActive: u.isActive
            }))
        });
    } catch (error) {
        console.error('Error fetching hierarchy:', error);
        return NextResponse.json({ error: 'Failed to fetch hierarchy' }, { status: 500 });
    }
}

/**
 * PUT /api/admin/hierarchy - Assign a user to a manager
 * Body: { userId, managedBy }
 */
export async function PUT(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        const { userId, managedBy, children } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const user = await db.getUserById(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Validate the hierarchy: Admin → Div Head → Dept Head → PM → Vendor
        if (managedBy) {
            const manager = await db.getUserById(managedBy);
            if (!manager) {
                return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
            }

            // Validate hierarchy rules for new workflow:
            // Admin → Divisional Head → Department Head → PM → Vendor
            const managerRole = getNormalizedRole(manager);
            const userRole = getNormalizedRole(user);

            const validHierarchy = {
                [ROLES.DIVISIONAL_HEAD]: [ROLES.ADMIN],
                [ROLES.DEPARTMENT_HEAD]: [ROLES.DIVISIONAL_HEAD, ROLES.ADMIN],
                [ROLES.PROJECT_MANAGER]: [ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD, ROLES.ADMIN],
                [ROLES.VENDOR]: [ROLES.PROJECT_MANAGER],
            };

            const allowedManagerRoles = validHierarchy[userRole];
            if (allowedManagerRoles && !allowedManagerRoles.includes(managerRole)) {
                return NextResponse.json({
                    error: `A ${userRole} can only be managed by: ${allowedManagerRoles.join(', ')}`
                }, { status: 400 });
            }
        }

        // Update parent (managedBy)
        if (managedBy !== undefined) {
            await db.updateUserManagedBy(userId, managedBy || null);
        }

        // Update children (bulk replacement)
        if (Array.isArray(children)) {
            // 1. Get current children of this manager (using custom id)
            const currentChildren = await db.getAllUsers();
            const childrenToUnassign = currentChildren.filter(u => u.managedBy === userId && !children.includes(u.id));

            // 2. Unassign those no longer in the list
            for (const child of childrenToUnassign) {
                await db.updateUserManagedBy(child.id, null);
            }

            // 3. Assign new children
            for (const childId of children) {
                await db.updateUserManagedBy(childId, userId);
            }
        }

        // Audit trail
        await db.createAuditTrailEntry({
            invoice_id: null,
            username: session.user.name || session.user.email,
            action: 'HIERARCHY_UPDATED',
            details: `Atomic hierarchy update for ${user.name}. Parent: ${managedBy || 'None'}, Subordinates count: ${children?.length || 0}`
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating hierarchy:', error);
        return NextResponse.json({ error: 'Failed to update hierarchy' }, { status: 500 });
    }
}
