import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import connectToDatabase from '@/lib/mongodb';
import { RateCard } from '@/models/Admin';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';

/**
 * GET /api/admin/ratecards/:id - Get rate card details (Admin only)
 */
export async function GET(request, { params }) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN, ROLES.PROJECT_MANAGER])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const { id } = await params;
        const ratecard = await RateCard.findOne({ id });

        if (!ratecard) {
            return NextResponse.json({ error: 'Rate card not found' }, { status: 404 });
        }

        // Enrich with vendor name
        const vendor = await db.getVendor(ratecard.vendorId);

        return NextResponse.json({
            ratecard: {
                ...ratecard.toObject(),
                vendorName: vendor?.name || 'Unknown Vendor'
            }
        });
    } catch (error) {
        console.error('Error fetching rate card:', error);
        return NextResponse.json({ error: 'Failed to fetch rate card' }, { status: 500 });
    }
}

/**
 * PUT /api/admin/ratecards/:id - Update rate card (Admin only)
 */
export async function PUT(request, { params }) {
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

        const { id } = await params;
        const body = await request.json();
        const { name, rates, effectiveFrom, effectiveTo, status, notes } = body;

        const existingCard = await RateCard.findOne({ id });
        if (!existingCard) {
            return NextResponse.json({ error: 'Rate card not found' }, { status: 404 });
        }

        // Validate rates structure if provided
        if (rates) {
            for (const rate of rates) {
                if (!rate.role || !rate.roleCode || !rate.experienceRange || !rate.unit || rate.rate === undefined) {
                    return NextResponse.json(
                        { error: 'Each rate must have role, roleCode, experienceRange, unit, and rate' },
                        { status: 400 }
                    );
                }
            }
        }

        // Build update
        const updateData = {};
        if (name) updateData.name = name;
        if (rates) updateData.rates = rates;
        if (effectiveFrom) updateData.effectiveFrom = new Date(effectiveFrom);
        if (effectiveTo !== undefined) updateData.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;

        const ratecard = await RateCard.findOneAndUpdate(
            { id },
            updateData,
            { new: true }
        );

        // Audit trail
        await db.createAuditTrailEntry({
            invoice_id: null,
            username: session.user.name || session.user.email,
            action: 'RATE_CARD_UPDATED',
            details: `Updated rate card: ${ratecard.name}`
        });

        return NextResponse.json({ success: true, ratecard: ratecard.toObject() });
    } catch (error) {
        console.error('Error updating rate card:', error);
        return NextResponse.json({ error: 'Failed to update rate card' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/ratecards/:id - Archive rate card (Admin only)
 */
export async function DELETE(request, { params }) {
    try {
        const session = await getSession();
        if (!session?.user) {
            console.error('DELETE rate card: Not authenticated');
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            console.error('DELETE rate card: Forbidden -', roleCheck.reason);
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const { id } = await params;
        console.log('DELETE rate card request for ID:', id);
        
        const ratecard = await RateCard.findOne({ id });
        if (!ratecard) {
            console.error('DELETE rate card: Not found -', id);
            return NextResponse.json({ error: 'Rate card not found' }, { status: 404 });
        }

        // Check if this is a permanent delete or archive (default is archive for backward compatibility)
        let body = {};
        try {
            body = await request.json();
        } catch (e) {
            console.log('DELETE rate card: No JSON body provided, defaulting to archive');
        }
        
        const permanent = body.permanent === true;
        console.log('DELETE rate card: permanent =', permanent);

        if (permanent) {
            // Hard delete - permanently remove from database
            console.log('DELETE rate card: Permanently deleting', ratecard.name);
            await RateCard.deleteOne({ id });

            // Audit trail
            await db.createAuditTrailEntry({
                invoice_id: null,
                username: session.user.name || session.user.email,
                action: 'RATE_CARD_DELETED',
                details: `Permanently deleted rate card: ${ratecard.name}`
            });

            console.log('DELETE rate card: Successfully deleted');
            return NextResponse.json({ success: true, message: 'Rate card deleted permanently' });
        } else {
            // Soft delete - archive instead of delete
            console.log('DELETE rate card: Archiving', ratecard.name);
            await RateCard.findOneAndUpdate({ id }, { status: 'EXPIRED' });

            // Audit trail
            await db.createAuditTrailEntry({
                invoice_id: null,
                username: session.user.name || session.user.email,
                action: 'RATE_CARD_ARCHIVED',
                details: `Archived rate card: ${ratecard.name}`
            });

            console.log('DELETE rate card: Successfully archived');
            return NextResponse.json({ success: true, message: 'Rate card archived' });
        }
    } catch (error) {
        console.error('Error deleting/archiving rate card:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete rate card' }, { status: 500 });
    }
}
