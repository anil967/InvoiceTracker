import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { db } from '@/lib/db';
import { ROLES } from '@/constants/roles';

/**
 * GET /api/users/by-role?role=PM - Public endpoint to get users by role
 * Returns only active users with limited fields (id, name)
 * Used by signup page for vendor PM selection
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get('role');

        if (!role) {
            return NextResponse.json({ error: 'role parameter is required' }, { status: 400 });
        }

        // Only allow fetching PMs (for vendor signup) - restrict to safe roles
        const allowedRoles = [ROLES.PROJECT_MANAGER];
        if (!allowedRoles.includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        const users = await db.getUsersByRole(role);

        // Return only safe, minimal fields
        return NextResponse.json({
            users: users.map(u => ({
                id: u.id,
                name: u.name
            }))
        });
    } catch (error) {
        console.error('Error fetching users by role:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}
