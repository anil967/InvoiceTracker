import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireRole, checkPermission } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/admin/users - List all users (Admin only)
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

        // Get query params for filtering
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        let users = await db.getAllUsers();

        // Apply filters
        if (role) {
            users = users.filter(u => u.role === role);
        }
        if (status === 'active') {
            users = users.filter(u => u.isActive !== false);
        } else if (status === 'inactive') {
            users = users.filter(u => u.isActive === false);
        }
        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter(u =>
                u.name?.toLowerCase().includes(searchLower) ||
                u.email?.toLowerCase().includes(searchLower)
            );
        }

        return NextResponse.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

/**
 * POST /api/admin/users - Create new user (Admin only)
 */
export async function POST(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        const body = await request.json();
        const { name, email, password, role, assignedProjects, vendorId, department, managedBy } = body;

        // Validation
        if (!name || !email || !password || !role) {
            return NextResponse.json(
                { error: 'Missing required fields: name, email, password, role' },
                { status: 400 }
            );
        }

        // Validate role
        if (!Object.values(ROLES).includes(role)) {
            return NextResponse.json(
                { error: `Invalid role. Must be one of: ${Object.values(ROLES).join(', ')}` },
                { status: 400 }
            );
        }

        // Check if email exists
        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            return NextResponse.json(
                { error: 'User with this email already exists' },
                { status: 409 }
            );
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const user = await db.createUser({
            id: uuidv4(),
            name,
            email: email.toLowerCase(),
            passwordHash,
            role,
            assignedProjects: assignedProjects || [],
            vendorId: vendorId || null,
            department: department || null,
            managedBy: managedBy || null,
            isActive: true,
            permissions: []
        });

        // Audit trail
        await db.createAuditTrailEntry({
            invoice_id: null,
            username: session.user.name || session.user.email,
            action: 'USER_CREATED',
            details: `Created user: ${email} with role: ${role}`
        });

        return NextResponse.json({
            success: true,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}
