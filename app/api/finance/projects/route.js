import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Project } from '@/models/Admin';
import { getSession } from '@/lib/auth';
import { requireRole, getNormalizedRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';

/**
 * GET /api/finance/projects - Get projects accessible to Finance users
 * Finance users typically need access to all projects for their work
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN, ROLES.FINANCE_USER])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const userRole = getNormalizedRole(session.user);
        let query = {};

        // Finance users see all projects (they need full visibility for their work)
        // Admin also sees all projects
        // Unlike PMs who are restricted to their assigned projects

        const projects = await Project.find(query).sort({ created_at: -1 });

        return NextResponse.json({
            projects: projects.map(p => p.toObject())
        });
    } catch (error) {
        console.error('Error fetching finance projects:', error);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
}
