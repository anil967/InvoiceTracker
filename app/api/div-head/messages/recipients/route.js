import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getNormalizedRole } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';

export const dynamic = 'force-dynamic';

/**
 * GET /api/div-head/messages/recipients
 * Returns the list of users a Divisional Head can message (Department Heads and Admins)
 */
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const role = getNormalizedRole(user);
        if (role !== ROLES.DIVISIONAL_HEAD) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const allUsers = await db.getAllUsers();

        const recipients = allUsers
            .filter(u => [ROLES.DEPARTMENT_HEAD].includes(getNormalizedRole(u)))
            .filter(u => String(u.id) !== String(user.id))
            .map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: getNormalizedRole(u),
                type: 'DeptHead'
            }));

        return NextResponse.json(recipients);
    } catch (error) {
        console.error('Error fetching div-head messaging recipients:', error);
        return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
    }
}
