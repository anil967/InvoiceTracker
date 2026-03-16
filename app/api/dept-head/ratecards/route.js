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

        // Get all PMs managed by this Dept Head for cascading visibility
        // This is more robust than getPMForUser as it doesn't rely on a single hierarchy link
        const managedPMs = await db.getPMsManagedByUser(session.user.id, session.user.role);
        console.log('[DeptHead RateCards API] Managed PMs for cascading:', managedPMs);

        let query = {};
        if (vendorId) query.vendorId = vendorId;
        if (status) query.status = status;

        console.log('[DeptHead RateCards API] Query:', query);

        const ratecards = await RateCard.find(query).sort({ created_at: -1 });
        console.log('[DeptHead RateCards API] Found ratecards:', ratecards.length);
        
        // Filter to only include rate cards accessible via cascading from any managed PM
        const accessibleCards = ratecards.filter(card => {
            // Dept Head/Div Head sees rate cards if ANY of their managed PMs is in pmUserIds
            if (managedPMs.length > 0 && card.pmUserIds &&
                card.pmUserIds.some(pmId => managedPMs.includes(pmId))) return true;
            // Also allow access if the user themselves is in pmUserIds (direct assignment)
            if (card.pmUserIds && card.pmUserIds.includes(session.user.id)) return true;
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
