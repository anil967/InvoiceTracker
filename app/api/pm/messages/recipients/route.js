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

        // Only allow PMs, Admins, Vendors, and Finance Users
        if (![ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.VENDOR, ROLES.FINANCE_USER].includes(role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch all users once; filter strictly based on role-based flow
        const allUsers = await db.getAllUsers();

        if (role === ROLES.ADMIN) {
            // Admin can view messages but nobody sends TO admin.
            // Admin can message PMs, Vendors, Finance Users, Dept Heads, Div Heads.
            recipients = allUsers
                .filter(u => [
                    ROLES.PROJECT_MANAGER, ROLES.VENDOR, ROLES.FINANCE_USER,
                    ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD
                ].includes(getNormalizedRole(u)))
                .filter(u => String(u.id) !== String(user.id))
                .map(u => {
                    const r = getNormalizedRole(u);
                    const typeMap = {
                        [ROLES.VENDOR]: 'Vendor',
                        [ROLES.PROJECT_MANAGER]: 'PM',
                        [ROLES.FINANCE_USER]: 'FU',
                        [ROLES.DEPARTMENT_HEAD]: 'DeptHead',
                        [ROLES.DIVISIONAL_HEAD]: 'DivHead',
                    };
                    return { id: u.id, name: u.name, email: u.email, role: r, type: typeMap[r] || r };
                });
        } else if (role === ROLES.PROJECT_MANAGER) {
            // PM can message Vendors, Finance Users, and Department Heads
            recipients = allUsers
                .filter(u => [ROLES.VENDOR, ROLES.FINANCE_USER, ROLES.DEPARTMENT_HEAD].includes(getNormalizedRole(u)))
                .map(u => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: getNormalizedRole(u),
                    type: getNormalizedRole(u) === ROLES.VENDOR ? 'Vendor'
                        : getNormalizedRole(u) === ROLES.DEPARTMENT_HEAD ? 'DeptHead'
                            : 'FU'
                }));
        } else if (role === ROLES.VENDOR) {
            // Vendor can only message PMs
            recipients = allUsers
                .filter(u => getNormalizedRole(u) === ROLES.PROJECT_MANAGER)
                .map(u => ({ id: u.id, name: u.name, email: u.email, role: ROLES.PROJECT_MANAGER, type: 'PM' }));
        } else if (role === ROLES.FINANCE_USER) {
            // Finance User can only message PMs
            recipients = allUsers
                .filter(u => getNormalizedRole(u) === ROLES.PROJECT_MANAGER)
                .map(u => ({ id: u.id, name: u.name, email: u.email, role: ROLES.PROJECT_MANAGER, type: 'PM' }));
        }

        return NextResponse.json(recipients);
    } catch (error) {
        console.error('Error fetching messaging recipients:', error);
        return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
    }
}
