import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Project } from '@/models/Admin';
import { getSession } from '@/lib/auth';
import { requireRole, getNormalizedRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';

/**
 * GET /api/pm/projects - Get PM's assigned projects
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.FINANCE_USER])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const userRole = getNormalizedRole(session.user);
        let query = {};

        // PMs only see their assigned projects, Admin sees all
        if (userRole === ROLES.PROJECT_MANAGER) {
            query = { assignedPMs: session.user.id };
        }

        const projects = await Project.find(query).sort({ created_at: -1 });

        return NextResponse.json({
            projects: projects.map(p => p.toObject())
        });
    } catch (error) {
        console.error('Error fetching PM projects:', error);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
}
