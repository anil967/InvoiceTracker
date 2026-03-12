import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Message } from '@/models/Internal';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/messages
 * Admin-only endpoint to view all PM ↔ Vendor messages (read-only monitoring).
 *
 * Query params (all optional):
 * - search: text search across subject + content
 * - senderRole: 'PM' | 'Vendor' (filter by sender role)
 * - pmId: user id of PM participant
 * - vendorId: user id of Vendor participant
 * - startDate, endDate: ISO date strings to filter by created_at
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

        const { searchParams } = new URL(request.url);

        const search = searchParams.get('search') || '';
        const senderRoleFilter = searchParams.get('senderRole') || '';
        const pmId = searchParams.get('pmId') || '';
        const vendorId = searchParams.get('vendorId') || '';
        const startDate = searchParams.get('startDate') || '';
        const endDate = searchParams.get('endDate') || '';

        const andConditions = [];

        // Monitor all participant messages (exclude any admin-sender messages)
        andConditions.push({
            senderRole: { $in: [ROLES.PROJECT_MANAGER, ROLES.VENDOR, ROLES.FINANCE_USER] }
        });

        if (search) {
            const regex = new RegExp(search, 'i');
            andConditions.push({
                $or: [
                    { content: regex },
                    { subject: regex }
                ]
            });
        }

        if (senderRoleFilter === ROLES.PROJECT_MANAGER || senderRoleFilter === 'PM') {
            andConditions.push({ senderRole: ROLES.PROJECT_MANAGER });
        } else if (senderRoleFilter === ROLES.VENDOR || senderRoleFilter === 'Vendor') {
            andConditions.push({ senderRole: ROLES.VENDOR });
        }

        if (startDate || endDate) {
            const range = {};
            if (startDate) range.$gte = new Date(startDate);
            if (endDate) {
                // Include the entire end date by setting time to end of day if only date part is provided
                const end = new Date(endDate);
                if (!isNaN(end.getTime())) {
                    end.setHours(23, 59, 59, 999);
                    range.$lte = end;
                }
            }
            andConditions.push({ created_at: range });
        }

        if (pmId) {
            andConditions.push({
                $or: [
                    // PM as sender
                    { senderRole: ROLES.PROJECT_MANAGER, senderId: pmId },
                    // PM as recipient
                    { recipientId: pmId }
                ]
            });
        }

        if (vendorId) {
            andConditions.push({
                $or: [
                    // Vendor as sender
                    { senderRole: ROLES.VENDOR, senderId: vendorId },
                    // Vendor as recipient
                    { recipientId: vendorId }
                ]
            });
        }

        const query = andConditions.length ? { $and: andConditions } : {};

        const messages = await Message.find(query).sort({ created_at: -1 });

        return NextResponse.json({
            messages: messages.map(m => m.toObject())
        });
    } catch (error) {
        console.error('Error fetching admin messages:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

