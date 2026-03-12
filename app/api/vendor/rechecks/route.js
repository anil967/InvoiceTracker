import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Message } from '@/models/Internal';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';

/**
 * GET /api/vendor/rechecks - Get all re-check requests for the logged-in vendor
 * Returns messages with messageType='INFO_REQUEST' along with linked invoice data
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.VENDOR, ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        // Fetch all INFO_REQUEST messages sent to this vendor
        const messages = await Message.find({
            recipientId: session.user.id,
            messageType: 'INFO_REQUEST'
        }).sort({ created_at: -1 });

        // Enrich each message with invoice data
        const rechecks = await Promise.all(
            messages.map(async (msg) => {
                const msgObj = msg.toObject();
                let invoice = null;
                if (msgObj.invoiceId) {
                    try {
                        invoice = await db.getInvoice(msgObj.invoiceId);
                    } catch (e) {
                        console.warn(`[Vendor Rechecks] Could not fetch invoice ${msgObj.invoiceId}:`, e.message);
                    }
                }
                return {
                    ...msgObj,
                    invoice: invoice ? {
                        id: invoice.id,
                        invoiceNumber: invoice.invoiceNumber,
                        vendorName: invoice.vendorName,
                        amount: invoice.amount || invoice.totalAmount,
                        status: invoice.status,
                        originalName: invoice.originalName,
                        date: invoice.date,
                        receivedAt: invoice.receivedAt,
                        pmApproval: invoice.pmApproval
                    } : null
                };
            })
        );

        // Count unread re-check requests
        const unreadCount = messages.filter(m => !m.isRead).length;

        return NextResponse.json({ rechecks, unreadCount });
    } catch (error) {
        console.error('Error fetching vendor rechecks:', error);
        return NextResponse.json({ error: 'Failed to fetch re-check requests' }, { status: 500 });
    }
}
