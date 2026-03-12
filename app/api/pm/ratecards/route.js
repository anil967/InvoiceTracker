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
        if (vendorId) {
            query.vendorId = vendorId;
        }

        // Status filter - default to ACTIVE if not specified
        if (status) {
            query.status = status;
        } else {
            query.status = 'ACTIVE';
        }

        // Add effective date filters
        query.$and = [
            { $or: [{ effectiveFrom: { $lte: now } }, { effectiveFrom: null }] },
            { $or: [{ effectiveTo: { $gte: now } }, { effectiveTo: null }] }
        ];

        const ratecards = await RateCard.find(query).sort({ created_at: -1 });
        console.log('[PM RateCards API] Total ratecards matched:', ratecards.length);

        // Use all matched rate cards (broad visibility for PM/Dept Head/Div Head)
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
