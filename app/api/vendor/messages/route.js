import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Message } from '@/models/Internal';
import { getSession } from '@/lib/auth';
import { requireRole, getNormalizedRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/messages - Get Vendor's messages
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.VENDOR])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const invoiceId = searchParams.get('invoiceId');
        const type = searchParams.get('type') || 'all';

        let query = {};
        if (type === 'inbox') {
            query.recipientId = session.user.id;
        } else if (type === 'sent') {
            query.senderId = session.user.id;
        } else {
            query = {
                $or: [
                    { senderId: session.user.id },
                    { recipientId: session.user.id }
                ]
            };
        }

        if (invoiceId) query.invoiceId = invoiceId;

        const messages = await Message.find(query).sort({ created_at: -1 });

        const unreadCount = await Message.countDocuments({
            recipientId: session.user.id,
            isRead: false
        });

        return NextResponse.json({
            messages: messages.map(m => m.toObject()),
            unreadCount
        });
    } catch (error) {
        console.error('Error fetching vendor messages:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

/**
 * POST /api/vendor/messages - Send a message from Vendor
 */
export async function POST(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.VENDOR])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const body = await request.json();
        const { recipientId, invoiceId, subject, content, messageType, parentMessageId } = body;

        if (!recipientId || !content) {
            return NextResponse.json(
                { error: 'Missing required fields: recipientId, content' },
                { status: 400 }
            );
        }

        const recipient = await db.getUserById(recipientId);
        if (!recipient) {
            return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
        }

        // Vendor can message: PMs only
        const recipientRole = getNormalizedRole(recipient);
        if (recipientRole !== ROLES.PROJECT_MANAGER) {
            return NextResponse.json({
                error: `Vendors can only message Project Managers.`
            }, { status: 403 });
        }

        const messageId = uuidv4();
        const threadId = parentMessageId
            ? (await Message.findOne({ id: parentMessageId }))?.threadId || parentMessageId
            : messageId;

        const message = await Message.create({
            id: messageId,
            invoiceId: invoiceId || null,
            senderId: session.user.id,
            senderName: session.user.name || session.user.email,
            senderRole: getNormalizedRole(session.user),
            recipientId,
            recipientName: recipient.name,
            subject: subject || null,
            content,
            messageType: messageType || 'GENERAL',
            parentMessageId: parentMessageId || null,
            threadId
        });

        await db.createAuditTrailEntry({
            invoice_id: invoiceId || null,
            username: session.user.name || session.user.email,
            action: 'MESSAGE_SENT',
            details: `Vendor message sent to ${recipient.name}: ${subject || '(no subject)'}`
        });

        return NextResponse.json({
            success: true,
            message: message.toObject()
        }, { status: 201 });
    } catch (error) {
        console.error('Error sending vendor message:', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}

/**
 * PATCH /api/vendor/messages - Mark messages as read
 */
export async function PATCH(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.VENDOR])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const body = await request.json();
        const { messageIds } = body;

        if (!messageIds || !Array.isArray(messageIds)) {
            return NextResponse.json({ error: 'messageIds array required' }, { status: 400 });
        }

        await Message.updateMany(
            { id: { $in: messageIds }, recipientId: session.user.id },
            { isRead: true, readAt: new Date() }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error marking vendor messages as read:', error);
        return NextResponse.json({ error: 'Failed to update messages' }, { status: 500 });
    }
}
