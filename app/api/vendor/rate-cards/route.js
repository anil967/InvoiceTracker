import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';
import connectToDatabase from '@/lib/mongodb';
import { RateCard } from '@/models/Admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/rate-cards - Fetch rate cards assigned to the current vendor
 * Only Vendors can access their own rate cards
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Verify user has Vendor role
        const roleCheck = requireRole([ROLES.VENDOR])(user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        // Fetch rate cards for this vendor
        if (!user.vendorId) {
            return NextResponse.json({ rateCards: [] }, { status: 200 });
        }

        await connectToDatabase();

        // Build query for active rate cards assigned to this vendor
        const now = new Date();
        const conditions = [
            { vendorId: user.vendorId },
            { status: 'ACTIVE' },
            {
                $or: [
                    {
                        $and: [
                            { effectiveFrom: { $lte: now } },
                            { $or: [{ effectiveTo: { $gte: now } }, { effectiveTo: null }, { effectiveTo: { $exists: false } }] }
                        ]
                    },
                    { effectiveFrom: null },
                    { effectiveFrom: { $exists: false } }
                ]
            }
        ];

        const rateCards = await RateCard.find({ $and: conditions })
            .sort({ projectId: -1, effectiveFrom: -1 })
            .lean();

        return NextResponse.json({ rateCards });

    } catch (error) {
        console.error('Error fetching vendor rate cards:', error);
        return NextResponse.json({ error: 'Failed to fetch rate cards' }, { status: 500 });
    }
}
