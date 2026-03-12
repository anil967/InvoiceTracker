import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const currentUser = await getCurrentUser();
        const { getNormalizedRole: normalize } = await import('@/constants/roles');
        const role = normalize(currentUser);
        if (!currentUser || role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const users = await db.getAllUsers();
        return NextResponse.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const currentUser = await getCurrentUser();
        const { getNormalizedRole: normalize } = await import('@/constants/roles');
        const role = normalize(currentUser);
        if (!currentUser || role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const data = await request.json();

        // Validation
        if (!data.email || !data.name || !data.role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Password validation for new users
        if (!data.password || data.password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
        }

        // Check if user exists
        const existing = await db.getUserByEmail(data.email);
        if (existing) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 });
        }

        // Hash password from request
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.password, salt);

        const newUser = {
            id: `u-${Date.now()}`,
            name: data.name,
            email: data.email,
            role: data.role,
            passwordHash,
            assignedProjects: data.assignedProjects || [],
            assignedProjects: data.assignedProjects || [],
            vendorId: data.vendorId || null,
            isActive: data.isActive !== undefined ? data.isActive : true
        };

        const created = await db.createUser(newUser);
        return NextResponse.json(created, { status: 201 });

    } catch (error) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}
