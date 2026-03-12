import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ROLES } from '@/constants/roles';
import { getNormalizedRole } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pms - Get list of Project Managers (signed up as PM)
 * Accessible to authenticated users (e.g. vendors) for invoice assignment.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const users = await db.getAllUsers();

        // Filter to only return PMs with limited info (no sensitive data)
        const pms = users
            .filter(u => getNormalizedRole(u) === ROLES.PROJECT_MANAGER && u.isActive !== false)
            .map(pm => ({
                id: pm.id,
                name: pm.name,
                email: pm.email,
                department: pm.department || null
            }));

        return NextResponse.json({ pms });
    } catch (error) {
        console.error('Error fetching PMs:', error);
        return NextResponse.json({ error: 'Failed to fetch PMs' }, { status: 500 });
    }
}
