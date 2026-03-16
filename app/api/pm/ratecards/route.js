import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import connectToDatabase from '@/lib/mongodb';
import { RateCard, Project } from '@/models/Admin';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';

/**
 * GET /api/pm/ratecards - List rate cards (PM read-only view)
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Allow PM, Department Head, and Divisional Head to view rate cards (read-only access)
        const roleCheck = requireRole([ROLES.PROJECT_MANAGER, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const vendorId = searchParams.get('vendorId');
        const status = searchParams.get('status');

        console.log('[PM RateCards API] Filtering ratecards for user:', session.user.id, 'role:', session.user.role);

        // Build query with effective date filters (same as vendor API)
        const now = new Date();
        let query = {};
        
        // Status filter - default to ACTIVE if not specified
        if (status) {
            query.status = status;
        } else {
            query.status = 'ACTIVE';
        }

        // Add effective date filters - use flexible logic to include cards without date bounds
        const dateConditions = [
            {
                $and: [
                    { effectiveFrom: { $lte: now } },
                    { $or: [{ effectiveTo: { $gte: now } }, { effectiveTo: null }, { effectiveTo: { $exists: false } }] }
                ]
            },
            { effectiveFrom: null },
            { effectiveFrom: { $exists: false } }
        ];
        query.$or = dateConditions;

        // PM-specific filtering: Only show rate cards for projects this PM is assigned to
        // The pmUserIds array on rate cards contains PM user IDs who should have access
        const user = await db.getUserById(session.user.id);
        if (user && user.assignedProjects && user.assignedProjects.length > 0) {
            // PM has assigned projects - filter rate cards by pmUserIds
            query.pmUserIds = { $in: [session.user.id] };
        }
        // If PM has no assigned projects, they won't see any rate cards (query.pmUserIds will match nothing)

        if (vendorId) {
            query.vendorId = vendorId;
        }

        const ratecards = await RateCard.find(query).sort({ created_at: -1 });
        console.log('[PM RateCards API] Total ratecards matched:', ratecards.length, 'for PM:', session.user.id);

        // Filter to only rate cards relevant to this PM's projects
        const accessibleCards = ratecards;

        const enrichedCards = await Promise.all(accessibleCards.map(async (card) => {
            const vendor = await db.getVendor(card.vendorId);
            return {
                ...card.toObject(),
                vendorName: vendor?.name || 'Unknown Vendor'
            };
        }));

        return NextResponse.json({ ratecards: enrichedCards });
    } catch (error) {
        console.error('Error fetching PM rate cards:', error);
        return NextResponse.json({ error: 'Failed to fetch rate cards' }, { status: 500 });
    }
}
