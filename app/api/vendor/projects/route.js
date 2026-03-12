import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';
import { Project } from '@/models/Admin';
import connectToDatabase from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const user = await getCurrentUser();
        console.log('[API] Vendor Projects - User:', user);

        if (!user || user.role !== ROLES.VENDOR) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!user.vendorId) {
            return NextResponse.json({ error: 'No vendor profile linked to user' }, { status: 400 });
        }

        await connectToDatabase();

        // Find projects where vendorIds contains this vendor's ID
        const projects = await Project.find({
            vendorIds: user.vendorId,
            status: 'ACTIVE'
        }).select('id name ringiNumber billingMonth');

        return NextResponse.json(projects);
    } catch (error) {
        console.error('Error fetching vendor projects:', error);
        return NextResponse.json(
            { error: 'Failed to fetch projects', details: error.message },
            { status: 500 }
        );
    }
}
