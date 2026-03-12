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

        // Find the PM for this Div Head (or Dept Head) for cascading
        const pmUserId = await db.getPMForUser(session.user.id);

        let query = {};
        if (vendorId) query.vendorId = vendorId;
        if (status) query.status = status;

        const ratecards = await RateCard.find(query).sort({ created_at: -1 });
        
        // Filter to only include rate cards accessible via cascading from PM
        const accessibleCards = ratecards.filter(card => {
            // Div Head sees rate cards if their parent PM is in pmUserIds
            if (pmUserId && card.pmUserIds && card.pmUserIds.includes(pmUserId)) return true;
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
