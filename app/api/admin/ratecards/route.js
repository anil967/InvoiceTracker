import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import connectToDatabase from '@/lib/mongodb';
import { RateCard } from '@/models/Admin';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/admin/ratecards - List all rate cards (Admin only)
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        // Get query params for filtering
        const { searchParams } = new URL(request.url);
        const vendorId = searchParams.get('vendorId');
        const status = searchParams.get('status');

        let query = {};
        if (vendorId) query.vendorId = vendorId;
        if (status) query.status = status;

        const ratecards = await RateCard.find(query).sort({ created_at: -1 });

        // Enrich with vendor names
        const enrichedCards = await Promise.all(ratecards.map(async (card) => {
            const vendor = await db.getVendor(card.vendorId);
            return {
                ...card.toObject(),
                vendorName: vendor?.name || 'Unknown Vendor'
            };
        }));

        return NextResponse.json({ ratecards: enrichedCards });
    } catch (error) {
        console.error('Error fetching rate cards:', error);
        return NextResponse.json({ error: 'Failed to fetch rate cards' }, { status: 500 });
    }
}

/**
 * POST /api/admin/ratecards - Create new rate card (Admin only)
 */
export async function POST(request) {
    try {
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
        const { vendorId, projectId, name, rates, effectiveFrom, effectiveTo, notes } = body;

        // Validation
        if (!vendorId || !name || !rates || !Array.isArray(rates)) {
            return NextResponse.json(
                { error: 'Missing required fields: vendorId, name, rates' },
                { status: 400 }
            );
        }

        // Validate vendor exists
        const vendor = await db.getVendor(vendorId);
        if (!vendor) {
            return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
        }

        // Validate rates structure
        for (const rate of rates) {
            if (!rate.role || !rate.roleCode || !rate.experienceRange || !rate.unit || rate.rate === undefined) {
                return NextResponse.json(
                    { error: 'Each rate must have role, roleCode, experienceRange, unit, and rate' },
                    { status: 400 }
                );
            }
        }

        // Find all PMs associated with this vendor through projects
        const pmUserIds = await db.getPMsForVendor(vendorId);
        
        const ratecard = await RateCard.create({
            id: uuidv4(),
            vendorId,
            projectId: projectId || null,
            pmUserIds, // Store PMs for cascading
            name,
            rates,
            effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
            effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
            status: 'ACTIVE',
            createdBy: session.user.id,
            notes: notes || null
        });

        // Audit trail
        await db.createAuditTrailEntry({
            invoice_id: null,
            username: session.user.name || session.user.email,
            action: 'RATE_CARD_CREATED',
            details: `Created rate card "${name}" for vendor: ${vendor.name}`
        });

        return NextResponse.json({
            success: true,
            ratecard: ratecard.toObject()
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating rate card:', error);
        return NextResponse.json({ error: 'Failed to create rate card' }, { status: 500 });
    }
}
