import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ROLES } from '@/constants/roles';
import { getNormalizedRole } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/finance-users - Get list of Finance Users
 * Accessible to authenticated users (e.g. vendors) for invoice assignment.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const users = await db.getAllUsers();

        // Filter to only return Finance Users with limited info
        const financeUsers = users
            .filter(u => getNormalizedRole(u) === ROLES.FINANCE_USER && u.isActive !== false)
            .map(fu => ({
                id: fu.id,
                name: fu.name,
                email: fu.email
            }));

        return NextResponse.json({ financeUsers });
    } catch (error) {
        console.error('Error fetching Finance Users:', error);
        return NextResponse.json({ error: 'Failed to fetch Finance Users' }, { status: 500 });
    }
}
