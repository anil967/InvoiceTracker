import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getNormalizedRole } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';
import User from '@/models/Users';
import connectToDatabase from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const role = getNormalizedRole(user);

        // Only allow PMs and Admins
        if (![ROLES.PROJECT_MANAGER, ROLES.ADMIN].includes(role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let vendorList = [];

        if (role === ROLES.ADMIN) {
            // Admin sees all vendors (users with role VENDOR)
            // leveraging db.getAllUsers to filter for vendors
            const allUsers = await db.getAllUsers();
            vendorList = allUsers.filter(u => u.role === ROLES.VENDOR).map(v => ({
                id: v.vendorId || v.id, // Prefer vendor ID if linked
                name: v.name,
                linkedUserId: v.id,
                email: v.email
            }));
            console.log(`[PM Vendors API] Admin fetched ${vendorList.length} vendors`);
        } else {
            // PM sees vendors for assigned projects AND delegated projects
            await connectToDatabase();

            // Get the user's assigned projects
            const userRecord = await User.findOne({ id: user.id });
            const assignedProjectIds = userRecord?.assignedProjects || [];

            // Check for projects delegated TO this user
            const delegators = await User.find({
                delegatedTo: user.id,
                delegationExpiresAt: { $gt: new Date() }
            });
            const delegatedProjectIds = delegators.flatMap(u => u.assignedProjects || []);

            // Combine both assigned and delegated project IDs
            const allAccessibleProjectIds = [...new Set([...assignedProjectIds, ...delegatedProjectIds])];


            if (allAccessibleProjectIds.length === 0) {
                console.warn(`[PM Vendors API] PM ${user.id} has no accessible projects`);
                return NextResponse.json([]);
            }

            vendorList = await db.getVendorsForProjects(allAccessibleProjectIds);
            console.log(`[PM Vendors API] PM ${user.id} fetched ${vendorList.length} vendors for projects`);
        }

        return NextResponse.json(vendorList);
    } catch (error) {
        console.error('Error fetching PM vendors:', error);
        return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
    }
}
