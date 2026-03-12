import mongoose from 'mongoose';
import { getAdminDb } from '../lib/mongodb';

/**
 * Admin Models - Separate collections in admin_db database
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
            const db = getAdminDb();
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
            const db = getAdminDb();
            if (db) {
                const model = db.models[modelName] || db.model(modelName, schema);
                return new model(...args);
            }
            return new (mongoose.models[modelName])(...args);
        }
    });
}

// === Vendor Schema ===
const VendorSchema = new mongoose.Schema({
    id: { type: String, required: true },
    vendorCode: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    tax_id: { type: String },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    linkedUserId: { type: String },
    bankDetails: {
        accountName: { type: String },
        accountNumber: { type: String },
        bankName: { type: String },
        ifscCode: { type: String }
    },
    performanceMetrics: {
        totalInvoices: { type: Number, default: 0 },
        onTimePayments: { type: Number, default: 0 },
        rejectionRate: { type: Number, default: 0 }
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'vendors'
});

// === Project Schema ===
const ProjectSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    ringiNumber: { type: String },
    description: { type: String },
    status: {
        type: String,
        enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'],
        default: 'ACTIVE'
    },
    assignedPMs: [{ type: String }],
    vendorIds: [{ type: String }],
    billingMonth: { type: String }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'projects'
});

// === PurchaseOrder Schema ===
const VendorPoItemSchema = new mongoose.Schema({
    description: String,
    quantity: Number,
    unitPrice: Number,
    amount: Number,
    glAccount: String
}, { _id: false });

const PurchaseOrderSchema = new mongoose.Schema({
    id: { type: String, required: true },
    poNumber: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true },
    date: { type: String },
    totalAmount: { type: Number },
    currency: { type: String, default: 'INR' },
    status: { type: String, default: 'OPEN' },
    items: [VendorPoItemSchema]
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'purchase_orders'
});

// === RateCard Schema ===
const AdminRateItemSchema = new mongoose.Schema({
    role: { type: String, required: true },
    roleCode: {
        type: String,
        required: true,
        enum: ['v11', 'v12', 'v13', 'v14'],
        default: 'v11'
    },
    experienceRange: {
        type: String,
        required: true,
        enum: ['0-5', '5-10', '10+']
    },
    rate: { type: Number, required: true },
    unit: {
        type: String,
        enum: ['HOUR', 'DAY', 'FIXED', 'MONTHLY'],
        required: true
    },
    currency: { type: String, default: 'INR' }
}, { _id: false });

const RateCardSchema = new mongoose.Schema({
    id: { type: String, required: true },
    vendorId: { type: String, required: true },
    projectId: { type: String },
    pmUserIds: { type: [String], default: [] },
    name: { type: String, required: true },
    rates: [AdminRateItemSchema],
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    status: {
        type: String,
        enum: ['ACTIVE', 'EXPIRED', 'DRAFT'],
        default: 'ACTIVE'
    },
    createdBy: { type: String, required: true },
    notes: { type: String }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'rate_cards'
});

// === Delegation Schema ===
const DelegationSchema = new mongoose.Schema({
    id: { type: String, required: true },
    delegate_from: { type: String, required: true },
    delegate_to: { type: String, required: true },
    active: { type: Boolean, default: true }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'delegations'
});

// === AuditTrail Schema ===
const AuditTrailSchema = new mongoose.Schema({
    id: { type: String, required: true },
    invoice_id: { type: String },
    username: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: String },
    timestamp: { type: Date, default: Date.now }
}, { collection: 'audit_trails' });

// Export proxies instead of static models
export const Vendor = createModelProxy('Vendor', VendorSchema);
export const Project = createModelProxy('Project', ProjectSchema);
export const PurchaseOrder = createModelProxy('PurchaseOrder', PurchaseOrderSchema);
export const RateCard = createModelProxy('RateCard', RateCardSchema);
export const Delegation = createModelProxy('Delegation', DelegationSchema);
export const AuditTrail = createModelProxy('AuditTrail', AuditTrailSchema);
