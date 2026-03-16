import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import connectToDatabase from '@/lib/mongodb';
import { RateCard } from '@/models/Admin';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';

/**
 * GET /api/div-head/ratecards - List rate cards (Div Head read-only view)
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Allow Divisional Head and Department Head to view rate cards (read-only access)
        const roleCheck = requireRole([ROLES.DIVISIONAL_HEAD, ROLES.DEPARTMENT_HEAD])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const vendorId = searchParams.get('vendorId');
        const status = searchParams.get('status');

        // Get all PMs managed by this Div Head for cascading visibility
        // This is more robust than getPMForUser as it doesn't rely on a single hierarchy link
        const managedPMs = await db.getPMsManagedByUser(session.user.id, session.user.role);

        let query = {};
        if (vendorId) query.vendorId = vendorId;
        if (status) query.status = status;

        const ratecards = await RateCard.find(query).sort({ created_at: -1 });
        
        // Filter to only include rate cards accessible via cascading from any managed PM
        const accessibleCards = ratecards.filter(card => {
            // Div Head sees rate cards if ANY of their managed PMs is in pmUserIds
            if (managedPMs.length > 0 && card.pmUserIds &&
                card.pmUserIds.some(pmId => managedPMs.includes(pmId))) return true;
            // Also allow access if the user themselves is in pmUserIds (direct assignment)
            if (card.pmUserIds && card.pmUserIds.includes(session.user.id)) return true;
            return false;
        });

        const enrichedCards = await Promise.all(accessibleCards.map(async (card) => {
            const vendor = await db.getVendor(card.vendorId);
            return {
                ...card.toObject(),
                vendorName: vendor?.name || 'Unknown Vendor'
            };
        }));

        return NextResponse.json({ ratecards: enrichedCards });
    } catch (error) {
        console.error('Error fetching div-head rate cards:', error);
        return NextResponse.json({ error: 'Failed to fetch rate cards' }, { status: 500 });
    }
}
