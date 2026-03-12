import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import connectToDatabase from '@/lib/mongodb';
import { RateCard } from '@/models/Admin';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';

/**
 * GET /api/dept-head/ratecards - List rate cards (Dept Head read-only view)
 */
export async function GET(request) {
    try {
        console.log('[DeptHead RateCards API] Starting request...');
        
        const session = await getSession();
        if (!session?.user) {
            console.error('[DeptHead RateCards API] No session found');
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        console.log('[DeptHead RateCards API] Session user:', {
            userId: session.user.id,
            role: session.user.role,
            email: session.user.email
        });

        // Allow Department Head and Divisional Head to view rate cards (read-only access)
        const roleCheck = requireRole([ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD])(session.user);
        if (!roleCheck.allowed) {
            console.error('[DeptHead RateCards API] Role check failed:', roleCheck.reason);
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        console.log('[DeptHead RateCards API] Role check passed');
        
        await connectToDatabase();
        console.log('[DeptHead RateCards API] Database connected');

        const { searchParams } = new URL(request.url);
        const vendorId = searchParams.get('vendorId');
        const status = searchParams.get('status');
        
        console.log('[DeptHead RateCards API] Filters:', { vendorId, status });

        // Find the PM for this Dept Head (or Div Head) for cascading
        const pmUserId = await db.getPMForUser(session.user.id);
        console.log('[DeptHead RateCards API] PM for cascading:', pmUserId);

        let query = {};
        if (vendorId) query.vendorId = vendorId;
        if (status) query.status = status;

        console.log('[DeptHead RateCards API] Query:', query);

        const ratecards = await RateCard.find(query).sort({ created_at: -1 });
        console.log('[DeptHead RateCards API] Found ratecards:', ratecards.length);
        
        // Filter to only include rate cards accessible via cascading from PM
        const accessibleCards = ratecards.filter(card => {
            // Dept Head/Div Head sees rate cards if their parent PM is in pmUserIds
            if (pmUserId && card.pmUserIds && card.pmUserIds.includes(pmUserId)) return true;
            return false;
        });
        console.log('[DeptHead RateCards API] Accessible cards after filtering:', accessibleCards.length);

        const enrichedCards = await Promise.all(accessibleCards.map(async (card) => {
            const vendor = await db.getVendor(card.vendorId);
            return {
                ...card.toObject(),
                vendorName: vendor?.name || 'Unknown Vendor'
            };
        }));

        console.log('[DeptHead RateCards API] Returning enriched cards:', enrichedCards.length);
        return NextResponse.json({ ratecards: enrichedCards });
    } catch (error) {
        console.error('Error fetching dept-head rate cards:', error);
        return NextResponse.json({ error: 'Failed to fetch rate cards' }, { status: 500 });
    }
}
