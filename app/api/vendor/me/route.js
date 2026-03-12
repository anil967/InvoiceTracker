import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server-auth';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';
import connectToDatabase from '@/lib/mongodb';
import { Vendor } from '@/models/Admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/me - Get current vendor profile (Vendor only)
 * Returns vendorId, vendorCode (ve-001 style), and name for display across the portal.
 * If user has no vendorId (e.g. legacy account), creates a Vendor with unique vendorCode and links it.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        if (user.role !== ROLES.VENDOR) {
            return NextResponse.json({ error: 'Vendor access only' }, { status: 403 });
        }

        let vendorId = user.vendorId;

        if (!vendorId) {
            await connectToDatabase();
            let vendor = await Vendor.findOne({ linkedUserId: user.id }).lean();
            if (!vendor) {
                const newVendorId = 'v-' + String(user.id).replace(/-/g, '').slice(0, 8);
                const created = await db.createVendor({
                    id: newVendorId,
                    name: user.name || 'Vendor',
                    email: user.email || '',
                    linkedUserId: user.id,
                });
                vendor = created;
                await db.updateUserVendorId(user.id, created.id);
            }
            const v = vendor || {};
            const vendorCode = v.vendorCode || ('ve-' + String((v.id || '').replace(/^v-/, '') || '1').padStart(3, '0'));
            return NextResponse.json({
                vendorId: v.id,
                vendorCode,
                name: v.name || user.name,
                email: v.email || user.email,
            });
        }

        const vendor = await db.getVendor(vendorId);
        if (!vendor) {
            return NextResponse.json({
                vendorId,
                vendorCode: null,
                name: user.name,
                message: 'Vendor profile not found'
            });
        }

        return NextResponse.json({
            vendorId: vendor.id,
            vendorCode: vendor.vendorCode || null,
            name: vendor.name,
            email: vendor.email
        });
    } catch (error) {
        console.error('Error fetching vendor profile:', error);
        return NextResponse.json({ error: 'Failed to fetch vendor profile' }, { status: 500 });
    }
}
