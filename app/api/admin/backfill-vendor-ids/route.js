import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';
import connectToDatabase from '@/lib/mongodb';
import Users from '@/models/Users';
import { Vendor } from '@/models/Admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/backfill-vendor-ids
 * Assign vendor ID (Vendor record + vendorCode) to existing users who signed up as Vendor but have no vendorId.
 * Admin only.
 */
export async function POST() {
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

        const vendorUsers = await Users.find({ role: ROLES.VENDOR, $or: [{ vendorId: null }, { vendorId: { $exists: false } }] }).lean();
        const created = [];
        const skipped = [];

        for (const u of vendorUsers) {
            const existingVendor = await Vendor.findOne({ linkedUserId: u.id }).lean();
            if (existingVendor) {
                await db.updateUserVendorId(u.id, existingVendor.id);
                skipped.push({ userId: u.id, email: u.email, vendorId: existingVendor.id, vendorCode: existingVendor.vendorCode || 've-***' });
                continue;
            }

            const newVendorId = 'v-' + String(u.id).replace(/-/g, '').slice(0, 8);
            const vendor = await db.createVendor({
                id: newVendorId,
                name: u.name || 'Vendor',
                email: u.email || '',
                linkedUserId: u.id,
            });
            await db.updateUserVendorId(u.id, vendor.id);
            created.push({
                userId: u.id,
                email: u.email,
                vendorId: vendor.id,
                vendorCode: vendor.vendorCode || null,
            });
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${vendorUsers.length} vendor user(s).`,
            created: created.length,
            linkedExisting: skipped.length,
            details: { created, skipped },
        });
    } catch (error) {
        console.error('Backfill vendor IDs error:', error);
        return NextResponse.json(
            { error: 'Failed to backfill vendor IDs', details: error.message },
            { status: 500 }
        );
    }
}
