import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';
import { Project } from '@/models/Admin';
import User from '@/models/Users';
import connectToDatabase from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || user.role !== ROLES.VENDOR) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();

        const project = await Project.findOne({ id });

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Security check: Ensure this vendor is actually assigned to this project
        if (!project.vendorIds.includes(user.vendorId)) {
            return NextResponse.json({ error: 'Unauthorized access to project' }, { status: 403 });
        }

        // Fetch PM details
        const pms = await User.find({
            id: { $in: project.assignedPMs }
        }).select('id name email');

        return NextResponse.json(pms);

    } catch (error) {
        console.error('Error fetching project PMs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch project PMs', details: error.message },
            { status: 500 }
        );
    }
}
