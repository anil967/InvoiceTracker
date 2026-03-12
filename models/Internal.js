import mongoose from 'mongoose';
import { getInternalDb } from '../lib/mongodb';

/**
 * Internal Models - Separate collections in internal_data database
 */

// Helper to create a lazy model that always uses the correct connection
function createModelProxy(modelName, schema) {
    const dummy = function () { };
    // Register schema on default mongoose so it's available as fallback
    if (!mongoose.models[modelName]) {
        mongoose.model(modelName, schema);
    }
    return new Proxy(dummy, {
        get(target, prop) {
            if (prop === 'schema') return schema;
            const db = getInternalDb();
            if (db) {
                const model = db.models[modelName] || db.model(modelName, schema);
                const val = model[prop];
                return typeof val === 'function' ? val.bind(model) : val;
            }
            // Fallback to default mongoose model if connection isn't ready
            const model = mongoose.models[modelName];
            const val = model[prop];
            return typeof val === 'function' ? val.bind(model) : val;
        },
        construct(target, args) {
            const db = getInternalDb();
            if (db) {
                const model = db.models[modelName] || db.model(modelName, schema);
                return new model(...args);
            }
            return new (mongoose.models[modelName])(...args);
        }
    });
}

// === Otp Schema ===
const OtpSchema = new mongoose.Schema({
    id: { type: String, required: true },
    email: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: '0s' } // TTL index for OTP expiration
    }
}, {
    collection: 'otps'
});

// === DocumentUpload Schema ===
const DocumentUploadSchema = new mongoose.Schema({
    id: { type: String, required: true },
    projectId: { type: String },
    invoiceId: { type: String },
    type: {
        type: String,
        enum: ['RINGI', 'ANNEX', 'TIMESHEET', 'RATE_CARD', 'INVOICE', 'RFP_COMMERCIAL', 'OTHER'],
        required: true
    },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    mimeType: { type: String },
    fileSize: { type: Number },
    uploadedBy: { type: String, required: true },
    uploadedByRole: { type: String },
    metadata: {
        billingMonth: { type: String },
        validated: { type: Boolean, default: false },
        validationNotes: { type: String },
        ringiNumber: { type: String },
        projectName: { type: String },
        description: { type: String },
        validationData: { type: mongoose.Schema.Types.Mixed }
    },
    status: {
        type: String,
        enum: ['PENDING', 'VALIDATED', 'REJECTED'],
        default: 'PENDING'
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'document_uploads'
});

// === Notification Schema ===
const NotificationSchema = new mongoose.Schema({
    id: { type: String, required: true },
    recipient_email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String },
    status: { type: String, enum: ['SENT', 'FAILED'], default: 'SENT' },
    sent_at: { type: Date, default: Date.now },
    related_entity_id: { type: String },
    notification_type: { type: String }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'notifications'
});

// === Message Schema ===
const MessageSchema = new mongoose.Schema({
    id: { type: String, required: true },
    // Context
    invoiceId: { type: String },
    projectId: { type: String },
    // Participants
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, required: true },
    recipientId: { type: String, required: true },
    recipientName: { type: String },
    // Message content
    subject: { type: String },
    content: { type: String, required: true },
    messageType: {
        type: String,
        enum: ['GENERAL', 'INFO_REQUEST', 'CLARIFICATION', 'DOCUMENT_REQUEST', 'APPROVAL_NOTIFICATION', 'REJECTION', 'STATUS_UPDATE'],
        default: 'GENERAL'
    },
    // Status
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    // Thread support
    parentMessageId: { type: String },
    threadId: { type: String }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'messages'
});

// === Annexure Schema ===
const AnnexureSchema = new mongoose.Schema({
    id: { type: String, required: true },
    annexureNumber: { type: String },
    poId: { type: String, required: true },
    originalAmount: { type: Number },
    approvedAmount: { type: Number },
    description: { type: String },
    status: { type: String, default: 'APPROVED' }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'annexures'
});

// Export proxies instead of static models
export const Otp = createModelProxy('Otp', OtpSchema);
export const DocumentUpload = createModelProxy('DocumentUpload', DocumentUploadSchema);
export const Notification = createModelProxy('Notification', NotificationSchema);
export const Message = createModelProxy('Message', MessageSchema);
export const Annexure = createModelProxy('Annexure', AnnexureSchema);
