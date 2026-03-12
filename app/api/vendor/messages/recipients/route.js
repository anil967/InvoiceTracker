import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getNormalizedRole } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const role = getNormalizedRole(user);
        let recipients = [];

        // Only allow Vendors to access this endpoint
        if (role !== ROLES.VENDOR) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch all users
        const allUsers = await db.getAllUsers();

        // Vendor can only message PMs
        recipients = allUsers
            .filter(u => getNormalizedRole(u) === ROLES.PROJECT_MANAGER)
            .map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: ROLES.PROJECT_MANAGER,
                type: 'PM'
            }));

        return NextResponse.json(recipients);
    } catch (error) {
        console.error('Error fetching messaging recipients:', error);
        return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
    }
}
