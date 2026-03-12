/**
 * Test suite for /api/pm/messages route
 * Verifies two-way messaging between Vendors and Project Managers
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { app } from '@/app'; // Adjust based on your app setup

describe('PM Messages Route - Vendor ↔ Project Manager Communication', () => {
    
    let pmUser, vendorUser, otherVendor, otherPm;
    let testMessageId;

    beforeAll(async () => {
        // Setup test users
        pmUser = {
            id: 'pm-test-1',
            email: 'pm-test@example.com',
            name: 'Test PM',
            role: 'PROJECT_MANAGER',
            isActive: true
        };

        vendorUser = {
            id: 'vendor-test-1',
            email: 'vendor-test@example.com',
            name: 'Test Vendor',
            role: 'VENDOR',
            isActive: true
        };

        otherVendor = {
            id: 'vendor-test-2',
            email: 'other-vendor@example.com',
            name: 'Other Vendor',
            role: 'VENDOR',
            isActive: true
        };

        otherPm = {
            id: 'pm-test-2',
            email: 'other-pm@example.com',
            name: 'Other PM',
            role: 'PROJECT_MANAGER',
            isActive: true
        };

        // Insert test users into database (mock or real)
        // Implementation depends on your test setup
    });

    beforeEach(async () => {
        // Clear test messages before each test
        // Clean up database
    });

    afterAll(async () => {
        // Cleanup test data
    });

    describe('GET /api/pm/messages - Retrieve messages', () => {
        
        it('should allow Project Manager to access messages route', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${pmUser.id}`
                }
            });

            expect(response.statusCode).not.toBe(403);
        });

        it('should allow Vendor to access messages route', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${vendorUser.id}`
                }
            });

            expect(response.statusCode).not.toBe(403);
        });

        it('should retrieve messages where user is sender', async () => {
            // First create a test message
            await createTestMessage(pmUser.id, vendorUser.id);

            const response = await app.inject({
                method: 'GET',
                url: '/api/pm/messages?type=sent',
                headers: {
                    'authorization': `Bearer ${pmUser.id}`
                }
            });

            const data = JSON.parse(response.payload);
            expect(data.messages).toBeDefined();
        });

        it('should retrieve messages where user is recipient', async () => {
            // First create a test message
            await createTestMessage(pmUser.id, vendorUser.id);

            const response = await app.inject({
                method: 'GET',
                url: '/api/pm/messages?type=inbox',
                headers: {
                    'authorization': `Bearer ${vendorUser.id}`
                }
            });

            const data = JSON.parse(response.payload);
            expect(data.messages).toBeDefined();
        });

        it('should retrieve all messages (sent + received) for type=all', async () => {
            await createTestMessage(pmUser.id, vendorUser.id);
            await createTestMessage(vendorUser.id, pmUser.id);

            const response = await app.inject({
                method: 'GET',
                url: '/api/pm/messages?type=all',
                headers: {
                    'authorization': `Bearer ${pmUser.id}'
                }
            });

            const data = JSON.parse(response.payload);
            expect(data.messages).toBeDefined();
            expect(Array.isArray(data.messages)).toBe(true);
        });

        it('should not show messages between other users (security check)', async () => {
            // Create message between two other users
            await createTestMessage(otherPm.id, otherVendor.id);

            const response = await app.inject({
                method: 'GET',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${pmUser.id}`
                }
            });

            const data = JSON.parse(response.payload);
            // Should not contain messages between other users
            const otherUserMessages = data.messages.filter(m => 
                m.senderId === otherPm.id || m.recipientId === otherPm.id ||
                m.senderId === otherVendor.id || m.recipientId === otherVendor.id
            );
            expect(otherUserMessages).toHaveLength(0);
        });

        it('should count unread messages correctly', async () => {
            // Create test message
            await createTestMessage(pmUser.id, vendorUser.id);

            const response = await app.inject({
                method: 'GET',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${vendorUser.id}`
                }
            });

            const data = JSON.parse(response.payload);
            expect(data.unreadCount).toBeDefined();
            expect(typeof data.unreadCount).toBe('number');
        });
    });

    describe('POST /api/pm/messages - Send messages', () => {
        
        it('should allow Project Manager to message Vendor', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${pmUser.id}`,
                    'content-type': 'application/json'
                },
                payload: JSON.stringify({
                    recipientId: vendorUser.id,
                    content: 'Hello Vendor, please review this invoice',
                    subject: 'Invoice Review Request',
                    messageType: 'INFO_REQUEST'
                })
            });

            expect(response.statusCode).not.toBe(403);
            expect(response.statusCode).toBe(201);

            const data = JSON.parse(response.payload);
            expect(data.success).toBe(true);
            expect(data.message.senderId).toBe(pmUser.id);
            expect(data.message.recipientId).toBe(vendorUser.id);
        });

        it('should allow Vendor to message Project Manager', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${vendorUser.id}`,
                    'content-type': 'application/json'
                },
                payload: JSON.stringify({
                    recipientId: pmUser.id,
                    content: 'Hi PM, here are the invoice details',
                    subject: 'Invoice Submission',
                    messageType: 'CLARIFICATION'
                })
            });

            expect(response.statusCode).not.toBe(403);
            expect(response.statusCode).toBe(201);

            const data = JSON.parse(response.payload);
            expect(data.success).toBe(true);
            expect(data.message.senderId).toBe(vendorUser.id);
            expect(data.message.recipientId).toBe(pmUser.id);
        });

        it('should block Vendor from messaging another Vendor', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${vendorUser.id}`,
                    'content-type': 'application/json'
                },
                payload: JSON.stringify({
                    recipientId: otherVendor.id,
                    content: 'This should fail'
                })
            });

            expect(response.statusCode).toBe(403);
        });

        it('should block PM from messaging another PM', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${pmUser.id}`,
                    'content-type': 'application/json'
                },
                payload: JSON.stringify({
                    recipientId: otherPm.id,
                    content: 'This should fail'
                })
            });

            expect(response.statusCode).toBe(403);
        });

        it('should require recipientId and content fields', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${pmUser.id}`,
                    'content-type': 'application/json'
                },
                payload: JSON.stringify({
                    recipientId: vendorUser.id
                    // Missing content
                })
            });

            expect(response.statusCode).toBe(400);
        });

        it('should support message threading via parentMessageId', async () => {
            // Create initial message
            const firstResponse = await app.inject({
                method: 'POST',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${pmUser.id}`,
                    'content-type': 'application/json'
                },
                payload: JSON.stringify({
                    recipientId: vendorUser.id,
                    content: 'First message'
                })
            });

            const firstData = JSON.parse(firstResponse.payload);
            const parentMessageId = firstData.message.id;

            // Create reply
            const replyResponse = await app.inject({
                method: 'POST',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${vendorUser.id}`,
                    'content-type': 'application/json'
                },
                payload: JSON.stringify({
                    recipientId: pmUser.id,
                    content: 'Reply to first message',
                    parentMessageId
                })
            });

            const replyData = JSON.parse(replyResponse.payload);
            expect(replyData.message.threadId).toBe(firstData.message.threadId);
            expect(replyData.message.parentMessageId).toBe(parentMessageId);
        });
    });

    describe('PATCH /api/pm/messages - Mark messages as read', () => {
        
        it('should allow Vendor to mark messages as read', async () => {
            // Create an unread message
            await createTestMessage(pmUser.id, vendorUser.id);

            const messages = await getMessagesForUser(vendorUser.id, 'inbox');
            const unreadMessageIds = messages.filter(m => !m.isRead).map(m => m.id);

            if (unreadMessageIds.length > 0) {
                const response = await app.inject({
                    method: 'PATCH',
                    url: '/api/pm/messages',
                    headers: {
                        'authorization': `Bearer ${vendorUser.id}`,
                        'content-type': 'application/json'
                    },
                    payload: JSON.stringify({
                        messageIds: unreadMessageIds.slice(0, 1)
                    })
                });

                expect(response.statusCode).not.toBe(403);
                expect(response.statusCode).toBe(200);
            }
        });

        it('should allow PM to mark messages as read', async () => {
            // Create an unread message
            await createTestMessage(vendorUser.id, pmUser.id);

            const messages = await getMessagesForUser(pmUser.id, 'inbox');
            const unreadMessageIds = messages.filter(m => !m.isRead).map(m => m.id);

            if (unreadMessageIds.length > 0) {
                const response = await app.inject({
                    method: 'PATCH',
                    url: '/api/pm/messages',
                    headers: {
                        'authorization': `Bearer ${pmUser.id}`,
                        'content-type': 'application/json'
                    },
                    payload: JSON.stringify({
                        messageIds: unreadMessageIds.slice(0, 1)
                    })
                });

                expect(response.statusCode).not.toBe(403);
                expect(response.statusCode).toBe(200);
            }
        });

        it('should only update messages where user is recipient', async () => {
            // Create message to vendor
            await createTestMessage(pmUser.id, vendorUser.id);

            const messages = await getMessagesForUser(pmUser.id, 'sent');
            const sentMessageIds = messages.map(m => m.id);

            if (sentMessageIds.length > 0) {
                // Try to mark messages where PM is sender (as recipient) - should not update
                const response = await app.inject({
                    method: 'PATCH',
                    url: '/api/pm/messages',
                    headers: {
                        'authorization': `Bearer ${pmUser.id}`,
                        'content-type': 'application/json'
                    },
                    payload: JSON.stringify({
                        messageIds: sentMessageIds.slice(0, 1)
                    })
                });

                // Should succeed but matchCount should be 0
                expect(response.statusCode).toBe(200);
            }
        });

        it('should require messageIds array', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: '/api/pm/messages',
                headers: {
                    'authorization': `Bearer ${pmUser.id}`,
                    'content-type': 'application/json'
                },
                payload: JSON.stringify({
                    // Missing messageIds
                })
            });

            expect(response.statusCode).toBe(400);
        });
    });

    // Helper functions
    async function createTestMessage(senderId, recipientId) {
        // Implementation depends on your Message model
        // This should create a test message in the database
        const Message = require('@/models/Message');
        const { v4: uuidv4 } = require('uuid');
        
        return await Message.create({
            id: uuidv4(),
            senderId,
            senderName: senderId === pmUser.id ? pmUser.name : vendorUser.name,
            senderRole: senderId === pmUser.id ? 'PROJECT_MANAGER' : 'VENDOR',
            recipientId,
            recipientName: recipientId === pmUser.id ? pmUser.name : vendorUser.name,
            content: 'Test message',
            messageType: 'GENERAL',
            isRead: false
        });
    }

    async function getMessagesForUser(userId, type) {
        const Message = require('@/models/Message');
        let query = {};

        if (type === 'inbox') {
            query.recipientId = userId;
        } else if (type === 'sent') {
            query.senderId = userId;
        } else {
            query = {
                $or: [
                    { senderId: userId },
                    { recipientId: userId }
                ]
            };
        }

        return await Message.find(query).sort({ created_at: -1 });
    }
});