import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Project } from '@/models/Admin';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/projects - List all projects (Admin only)
 */
export async function GET(request) {
    try {
        // During build, MONGODB_URI may be unset - return empty to avoid build failure
        if (!process.env.MONGODB_URI) {
            return NextResponse.json({ projects: [] });
        }
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        let query = {};
        if (status) query.status = status;

        const projects = await Project.find(query).sort({ created_at: -1 });

        // Enrich with PM names
        const enrichedProjects = await Promise.all(projects.map(async (project) => {
            const pmNames = await Promise.all(
                (project.assignedPMs || []).map(async (pmId) => {
                    const user = await db.getUserById(pmId);
                    return user?.name || 'Unknown';
                })
            );
            return {
                ...project.toObject(),
                pmNames
            };
        }));

        return NextResponse.json({ projects: enrichedProjects });
    } catch (error) {
        console.error('Error fetching projects:', error);
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }
}

/**
 * POST /api/admin/projects - Create new project (Admin only)
 */
export async function POST(request) {
    try {
        if (!process.env.MONGODB_URI) {
            return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
        }
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const body = await request.json();
        const { name, ringiNumber, description, assignedPMs, vendorIds, billingMonth } = body;

        if (!name) {
            return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
        }

        const project = await Project.create({
            id: uuidv4(),
            name,
            ringiNumber: ringiNumber || null,
            description: description || null,
            status: 'ACTIVE',
            assignedPMs: assignedPMs || [],
            vendorIds: vendorIds || [],
            billingMonth: billingMonth || null
        });

        // Update PM users with assigned project
        if (assignedPMs?.length) {
            for (const pmId of assignedPMs) {
                const user = await db.getUserById(pmId);
                if (user && getNormalizedRole(user) === ROLES.PROJECT_MANAGER) {
                    const currentProjects = user.assignedProjects || [];
                    if (!currentProjects.includes(project.id)) {
                        await db.syncPMAssignments(pmId, [...currentProjects, project.id]);
                    }
                }
            }
        }

        await db.createAuditTrailEntry({
            invoice_id: null,
            username: session.user.name || session.user.email,
            action: 'PROJECT_CREATED',
            details: `Created project: ${name}`
        });

        return NextResponse.json({ success: true, project: project.toObject() }, { status: 201 });
    } catch (error) {
        console.error('Error creating project:', error);
        return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }
}
