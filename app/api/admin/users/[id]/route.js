import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import bcrypt from 'bcryptjs';

/**
 * GET /api/admin/users/:id - Get user details (Admin only)
 */
export async function GET(request, { params }) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        const { id } = await params;
        const user = await db.getUserById(id);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Error fetching user:', error);
        return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }
}

/**
 * PUT /api/admin/users/:id - Update user (Admin only)
 */
export async function PUT(request, { params }) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, role, assignedProjects, vendorId, department, isActive, permissions, password, managedBy } = body;

        const existingUser = await db.getUserById(id);
        if (!existingUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Validate role if being updated
        if (role && !Object.values(ROLES).includes(role)) {
            return NextResponse.json(
                { error: `Invalid role. Must be one of: ${Object.values(ROLES).join(', ')}` },
                { status: 400 }
            );
        }

        // Build update data
        const updateData = {
            id,
            name: name || existingUser.name,
            email: existingUser.email, // Email cannot be changed
            passwordHash: existingUser.password_hash,
            role: role || existingUser.role,
            assignedProjects: assignedProjects ?? existingUser.assignedProjects,
            vendorId: vendorId ?? existingUser.vendorId,
            department: department ?? existingUser.department,
            managedBy: managedBy !== undefined ? managedBy : existingUser.managedBy,
            isActive: isActive ?? existingUser.isActive,
            permissions: permissions ?? existingUser.permissions
        };

        // If password is being reset
        if (password) {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        const user = await db.createUser(updateData);

        // If it's a PM, ensure assignments are synced across models
        if (updateData.role === ROLES.PROJECT_MANAGER && updateData.assignedProjects) {
            await db.syncPMAssignments(id, updateData.assignedProjects);
        }

        // Audit trail
        const changes = [];
        if (role && role !== existingUser.role) changes.push(`role: ${existingUser.role} → ${role}`);
        if (isActive !== undefined && isActive !== existingUser.isActive) {
            changes.push(isActive ? 'reactivated' : 'deactivated');
        }

        await db.createAuditTrailEntry({
            invoice_id: null,
            username: session.user.name || session.user.email,
            action: 'USER_UPDATED',
            details: `Updated user ${existingUser.email}: ${changes.join(', ') || 'profile updated'}`
        });

        return NextResponse.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/users/:id - Deactivate user (Admin only)
 * Note: Soft delete - sets isActive to false
 */
export async function DELETE(request, { params }) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        const { id } = await params;
        const existingUser = await db.getUserById(id);

        if (!existingUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Prevent self-deactivation
        if (existingUser.id === session.user.id) {
            return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
        }

        // Soft delete - deactivate user
        await db.createUser({
            ...existingUser,
            passwordHash: existingUser.password_hash,
            isActive: false
        });

        // Audit trail
        await db.createAuditTrailEntry({
            invoice_id: null,
            username: session.user.name || session.user.email,
            action: 'USER_DEACTIVATED',
            details: `Deactivated user: ${existingUser.email}`
        });

        return NextResponse.json({ success: true, message: 'User deactivated' });
    } catch (error) {
        console.error('Error deactivating user:', error);
        return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
    }
}
