import mongoose from 'mongoose';
import { getInternalDb } from '../lib/mongodb';

/**
 * Invoice Model - invoices collection in internal_data database
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

const ApprovalSchema = new mongoose.Schema({
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'INFO_REQUESTED'], default: 'PENDING' },
    approvedBy: { type: String },
    approvedByName: { type: String },    // Display name of approver
    approvedByRole: { type: String },
    approvedAt: { type: Date },
    notes: { type: String }
}, { _id: false });

const HILReviewSchema = new mongoose.Schema({
    status: { type: String, enum: ['PENDING', 'REVIEWED', 'FLAGGED'], default: 'PENDING' },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
    confidence: { type: Number },
    corrections: { type: mongoose.Schema.Types.Mixed }
}, { _id: false });

const InvoiceDocumentSchema = new mongoose.Schema({
    documentId: { type: String },
    type: { type: String },
    fileName: { type: String },  // Original filename for file-type detection
    fileData: { type: String },  // Data URI with Base64 content (data:mimeType;base64,xxxx)
    mimeType: { type: String },  // MIME type of the file
    uploadedAt: { type: String }  // ISO timestamp of upload
}, { _id: false });

// Enhanced audit trail for comprehensive workflow tracking
const AuditLogSchema = new mongoose.Schema({
    action: { type: String, required: true },           // Action performed (e.g., 'submitted', 'approved', 'rejected')
    actor: { type: String, required: true },            // Full name of person who performed the action
    actorId: { type: String, required: true },          // User ID of person who performed the action
    actorRole: { type: String, required: true },        // Role of person (Vendor, PM, Finance User, Admin)
    timestamp: { type: Date, default: Date.now },       // When the action occurred
    previousStatus: { type: String },                    // Invoice status before this action
    newStatus: { type: String },                         // Invoice status after this action
    notes: { type: String },                             // Optional notes/comments
    ipAddress: { type: String },                         // IP address of requestor
    userAgent: { type: String }                          // Browser/client information
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    vendorName: { type: String, required: true },
    submittedByUserId: { type: String }, // User id of submitter (vendor) - reliable filter for vendor list
    vendorId: { type: String }, // Vendor record id — uniquely identifies which vendor uploaded (for admin/PM display)
    originalName: { type: String },
    receivedAt: { type: Date },
    invoiceNumber: { type: String },
    date: { type: String },
    invoiceDate: { type: String }, // Separate invoice date field
    billingMonth: { type: String }, // Format: YYYY-MM
    amount: { type: Number },
    basicAmount: { type: Number }, // Amount before taxes
    totalAmount: { type: Number }, // Total amount including taxes
    taxType: { type: String, enum: ['CGST_SGST', 'IGST', ''] }, // Tax type dropdown
    hsnCode: { type: String }, // HSN Code
    // Invoice workflow status - follows PRD workflow: Submitted → PM → Finance
    status: {
        type: String,
        required: true,
        enum: [
            'Submitted',                    // Initial state when vendor submits
            'Pending PM Approval',          // Awaiting PM review
            'PM Approved',                  // PM approved, ready for Dept Head
            'PM Rejected',                  // PM rejected
            'More Info Needed',             // PM/Dept Head/Div Head requests additional info
            'Pending Dept Head Review',     // Awaiting Dept Head review after PM approval
            'Dept Head Rejected',           // Dept Head rejected
            'Pending Div Head Review',      // Awaiting Div Head review after Dept Head approval
            'Div Head Approved',            // Div Head approved - final state
            'Div Head Rejected',            // Div Head rejected - final state
            // Legacy statuses (kept for backward compatibility)
            'Pending Finance Review',       // Legacy: Awaiting Finance review after PM approval
            'Finance Approved',             // Legacy: Finance approved - final state
            'Finance Rejected'              // Legacy: Finance rejected - final state
        ],
        default: 'Submitted'
    },
    originatorRole: {
        type: String,
        enum: ['Admin', 'PM', 'Finance User', 'Vendor'],
        default: 'Vendor'
    }, // Role that initiated the invoice
    category: { type: String },
    dueDate: { type: String },
    costCenter: { type: String },
    accountCode: { type: String },
    currency: { type: String, default: 'INR' },
    fileUrl: { type: String },
    poNumber: { type: String },
    project: { type: String },
    matching: { type: mongoose.Schema.Types.Mixed },
    // Detailed Line Items for Rate Validation
    lineItems: [{
        role: { type: String, required: true }, // e.g. "Developer"
        experienceRange: { type: String, required: true }, // e.g. "5-10"
        description: { type: String }, // Optional details
        quantity: { type: Number, required: true }, // Hours or Days
        unit: { type: String, required: true }, // "HOUR", "DAY"
        rate: { type: Number, required: true }, // Submitted Rate
        amount: { type: Number, required: true }, // Calculated (Qty * Rate)
        status: { type: String, enum: ['MATCH', 'MISMATCH', 'MANUAL'], default: 'MATCH' } // System validation status
    }],
    // RBAC assignment fields
    assignedPM: { type: String },                       // PM user ID for this invoice - MANDATORY for workflow
    assignedFinanceUser: { type: String },              // Legacy FU assignment (retained for backward compat)
    assignedDeptHead: { type: String },                 // Department Head user ID for this invoice
    assignedDivHead: { type: String },                  // Divisional Head user ID for this invoice
    // Approval records per stage
    financeApproval: { type: ApprovalSchema, default: () => ({}) },
    pmApproval: { type: ApprovalSchema, default: () => ({}) },
    deptHeadApproval: { type: ApprovalSchema, default: () => ({}) },
    divHeadApproval: { type: ApprovalSchema, default: () => ({}) },
    adminApproval: { type: ApprovalSchema, default: () => ({}) },
    hilReview: { type: HILReviewSchema, default: () => ({}) },
    documents: [InvoiceDocumentSchema],
    auditTrail: [AuditLogSchema],  // Comprehensive audit trail for all workflow actions
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'invoices'
});

// Indexes for efficient queries
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ assignedPM: 1 });
InvoiceSchema.index({ assignedFinanceUser: 1 });
InvoiceSchema.index({ assignedDeptHead: 1 });
InvoiceSchema.index({ assignedDivHead: 1 });
InvoiceSchema.index({ submittedByUserId: 1 });
InvoiceSchema.index({ project: 1 });
InvoiceSchema.index({ 'financeApproval.status': 1 });
InvoiceSchema.index({ 'pmApproval.status': 1 });
InvoiceSchema.index({ 'deptHeadApproval.status': 1 });
InvoiceSchema.index({ 'divHeadApproval.status': 1 });
InvoiceSchema.index({ 'adminApproval.status': 1 });
InvoiceSchema.index({ 'hilReview.status': 1 });

// Index for efficient audit trail queries
InvoiceSchema.index({ 'auditTrail.timestamp': -1 });
InvoiceSchema.index({ 'auditTrail.actorId': 1 });

// Export proxy instead of static model
export default createModelProxy('Invoice', InvoiceSchema);

