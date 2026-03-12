import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Message } from '@/models/Internal';
import { getSession } from '@/lib/auth';
import { requireRole, getNormalizedRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/pm/messages - Get PM's messages (sent and received)
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.PROJECT_MANAGER, ROLES.VENDOR, ROLES.ADMIN])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const invoiceId = searchParams.get('invoiceId');
        const type = searchParams.get('type') || 'all'; // 'inbox', 'sent', 'all'

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

        // Additional security: Verify user can only see messages they're involved in
        // This ensures Vendors cannot see messages between other Vendors and PMs
        const messages = await Message.find(query).sort({ created_at: -1 });

        // Filter to ensure user is either sender or recipient (defensive security)
        const filteredMessages = messages.filter(msg =>
            msg.senderId === session.user.id || msg.recipientId === session.user.id
        );

        // Count unread (only count messages where user is recipient)
        const unreadCount = await Message.countDocuments({
            recipientId: session.user.id,
            isRead: false
        });

        return NextResponse.json({
            messages: filteredMessages.map(m => m.toObject()),
            unreadCount
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

/**
 * POST /api/pm/messages - Send a message to vendor
 */
export async function POST(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.PROJECT_MANAGER, ROLES.VENDOR])(session.user);
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

        // Get recipient details
        const recipient = await db.getUserById(recipientId);
        if (!recipient) {
            return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
        }

        // Security Check - Role-based messaging (cross-role only)
        // Security Check - Role-based messaging flow enforcement
        const userRole = getNormalizedRole(session.user);
        const recipientRole = getNormalizedRole(recipient);

        // 1. Block same-role messaging
        if (userRole === recipientRole) {
            return NextResponse.json({
                error: 'Cannot send messages to users of the same role. Cross-role messaging only.'
            }, { status: 403 });
        }

        // 2. Enforce allowed communication paths
        let flowAllowed = false;

        // Block sending TO Admin — Admin is read-only
        if (recipientRole === ROLES.ADMIN) {
            return NextResponse.json({
                error: 'Messages cannot be sent to Admin. Admin is read-only.'
            }, { status: 403 });
        }

        // PM can message Vendors, Finance Users, and Department Heads
        if (userRole === ROLES.PROJECT_MANAGER) {
            if ([ROLES.VENDOR, ROLES.FINANCE_USER, ROLES.DEPARTMENT_HEAD].includes(recipientRole)) flowAllowed = true;
        } else if (recipientRole === ROLES.PROJECT_MANAGER) {
            // Vendors, Finance Users, and Department Heads can message PMs
            if ([ROLES.VENDOR, ROLES.FINANCE_USER, ROLES.DEPARTMENT_HEAD].includes(userRole)) flowAllowed = true;
        }

        // Admin paths (Can message anyone except Admin receives nothing)
        if (userRole === ROLES.ADMIN) flowAllowed = true;

        if (!flowAllowed) {
            return NextResponse.json({
                error: `Communication not allowed between ${userRole} and ${recipientRole}.`
            }, { status: 403 });
        }

        // Create message
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

        // Audit trail
        await db.createAuditTrailEntry({
            invoice_id: invoiceId || null,
            username: session.user.name || session.user.email,
            action: 'MESSAGE_SENT',
            details: `Message sent to ${recipient.name}: ${subject || '(no subject)'}`
        });

        return NextResponse.json({
            success: true,
            message: message.toObject()
        }, { status: 201 });
    } catch (error) {
        console.error('Error sending message:', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }
}

/**
 * PATCH /api/pm/messages - Mark messages as read
 */
export async function PATCH(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.PROJECT_MANAGER, ROLES.VENDOR])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const body = await request.json();
        const { messageIds } = body;

        if (!messageIds || !Array.isArray(messageIds)) {
            return NextResponse.json({ error: 'messageIds array required' }, { status: 400 });
        }

        // Security check: Ensure the recipientId matches current user
        // This is built into the query, but we can add validation
        const updateResult = await Message.updateMany(
            {
                id: { $in: messageIds },
                recipientId: session.user.id
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        // Verify update was successful for security auditing
        if (updateResult.matchedCount === 0 && messageIds.length > 0) {
            // Either message IDs don't exist or user is not the recipient
            console.warn(`No messages were marked as read. User ${session.user.id} may not be recipient of messages ${messageIds.join(', ')}`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        return NextResponse.json({ error: 'Failed to update messages' }, { status: 500 });
    }
}
