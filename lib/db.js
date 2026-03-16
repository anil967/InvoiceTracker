// lib/db.js - MongoDB Implementation with multi-database support
import connectToDatabase, { getUsersDb, getAdminDb, getInternalDb } from '@/lib/mongodb';
import mongoose from 'mongoose';
import { ROLES } from '@/constants/roles';
import { getNormalizedRole } from '@/lib/rbac';
import { INVOICE_STATUS } from '@/lib/invoice-workflow';
import UsersDef from '@/models/Users';
import { Vendor as VendorDef, Project as ProjectDef, PurchaseOrder as PurchaseOrderDef, RateCard as RateCardDef, AuditTrail as AuditTrailDef, Delegation as DelegationDef } from '@/models/Admin';
import { Annexure as AnnexureDef, Notification as NotificationDef, Message as MessageDef, DocumentUpload as DocumentUploadDef, Otp as OtpDef } from '@/models/Internal';
import InvoiceDef from '@/models/Invoice';

// Top-level variables that will be assigned to connection-bound models
let Users, Vendor, Project, PurchaseOrder, RateCard, Delegation, AuditTrail, Otp, DocumentUpload, Notification, Message, Annexure, Invoice;

/**
 * Schema imports for multi-database model compilation
 * These schemas are imported separately from the models to recompile models on correct databases
 */

// Schema imports - access schema property directly from imported model instances
// Schema extraction - using the definition imports
const UsersSchema = UsersDef.schema;
const VendorSchema = VendorDef.schema;
const ProjectSchema = ProjectDef.schema;
const PurchaseOrderSchema = PurchaseOrderDef.schema;
const RateCardSchema = RateCardDef.schema;
const DelegationSchema = DelegationDef.schema;
const AuditTrailSchema = AuditTrailDef.schema;
const OtpSchema = OtpDef.schema;
const DocumentUploadSchema = DocumentUploadDef.schema;
const NotificationSchema = NotificationDef.schema;
const MessageSchema = MessageDef.schema;
const AnnexureSchema = AnnexureDef.schema;
const InvoiceSchema = InvoiceDef.schema;

/**
 * Model accessor functions - always use these to get models from correct database connections
 * These functions ensure queries go to the correct database (users, admin, internal_data)
 */

const getModels = () => ({
    Users: getUsersDb().model('Users'),
    Vendor: getAdminDb().model('Vendor'),
    Project: getAdminDb().model('Project'),
    PurchaseOrder: getAdminDb().model('PurchaseOrder'),
    RateCard: getAdminDb().model('RateCard'),
    Delegation: getAdminDb().model('Delegation'),
    AuditTrail: getAdminDb().model('AuditTrail'),
    Otp: getInternalDb().model('Otp'),
    DocumentUpload: getInternalDb().model('DocumentUpload'),
    Notification: getInternalDb().model('Notification'),
    Message: getInternalDb().model('Message'),
    Annexure: getInternalDb().model('Annexure'),
    Invoice: getInternalDb().model('Invoice'),
});

// Database connection cache
let _connectionsInitialized = false;
let _initializedModels = {
    usersDb: null,
    adminDb: null,
    internalDb: null
};

/**
 * Initialize models with their respective database connections.
 * This ensures each model is bound to the correct database (users, admin, internal_data).
 * Models are compiled only once using connection caching to prevent duplicate model errors.
 */
const initializeModels = async () => {
    try {
        console.log('Initializing models with database connections...');

        // Get all database connections
        const usersDb = getUsersDb();
        const adminDb = getAdminDb();
        const internalDb = getInternalDb();

        // Compile and assign models on users database
        try {
            Users = usersDb.model('Users', UsersSchema);
        } catch (e) {
            Users = usersDb.model('Users');
        }

        // Compile and assign models on admin database
        try {
            Vendor = adminDb.model('Vendor', VendorSchema);
            Project = adminDb.model('Project', ProjectSchema);
            PurchaseOrder = adminDb.model('PurchaseOrder', PurchaseOrderSchema);
            RateCard = adminDb.model('RateCard', RateCardSchema);
            Delegation = adminDb.model('Delegation', DelegationSchema);
            AuditTrail = adminDb.model('AuditTrail', AuditTrailSchema);
        } catch (e) {
            Vendor = adminDb.model('Vendor');
            Project = adminDb.model('Project');
            PurchaseOrder = adminDb.model('PurchaseOrder');
            RateCard = adminDb.model('RateCard');
            Delegation = adminDb.model('Delegation');
            AuditTrail = adminDb.model('AuditTrail');
        }

        // Compile and assign models on internal_data database
        try {
            Otp = internalDb.model('Otp', OtpSchema);
            DocumentUpload = internalDb.model('DocumentUpload', DocumentUploadSchema);
            Notification = internalDb.model('Notification', NotificationSchema);
            Message = internalDb.model('Message', MessageSchema);
            Annexure = internalDb.model('Annexure', AnnexureSchema);
            Invoice = internalDb.model('Invoice', InvoiceSchema);
        } catch (e) {
            Otp = internalDb.model('Otp');
            DocumentUpload = internalDb.model('DocumentUpload');
            Notification = internalDb.model('Notification');
            Message = internalDb.model('Message');
            Annexure = internalDb.model('Annexure');
            Invoice = internalDb.model('Invoice');
        }

        // Store initialized connections for reuse
        _initializedModels.usersDb = usersDb;
        _initializedModels.adminDb = adminDb;
        _initializedModels.internalDb = internalDb;

        console.log('Models initialized successfully across all databases');
    } catch (error) {
        console.error('Failed to initialize models:', error);
        throw error;
    }
};

/**
 * Helper functions to get models from the correct database connections
 * These ensure queries go to the correct database (users, admin, internal_data)
 */

const getUsersModel = () => getUsersDb().model('Users');

const getVendorModel = () => getAdminDb().model('Vendor');
const getProjectModel = () => getAdminDb().model('Project');
const getPurchaseOrderModel = () => getAdminDb().model('PurchaseOrder');
const getRateCardModel = () => getAdminDb().model('RateCard');
const getDelegationModel = () => getAdminDb().model('Delegation');
const getAuditTrailModel = () => getAdminDb().model('AuditTrail');

const getOtpModel = () => getInternalDb().model('Otp');
const getDocumentUploadModel = () => getInternalDb().model('DocumentUpload');
const getNotificationModel = () => getInternalDb().model('Notification');
const getMessageModel = () => getInternalDb().model('Message');
const getAnnexureModel = () => getInternalDb().model('Annexure');
const getInvoiceModel = () => getInternalDb().model('Invoice');

/**
 * Initialize all database connections and ensure models are properly bound
 * This function should be called once at application startup
 * @returns {Promise<void>}
 */
const initializeConnections = async () => {
    if (_connectionsInitialized) return;

    try {
        console.log('Initializing multi-database connections...');

        // Initialize all three database connections
        await connectToDatabase();
        await getUsersDb();
        await getAdminDb();
        await getInternalDb();

        // Initialize models with their respective database connections
        await initializeModels();

        console.log('Multi-database connections initialized successfully');
        _connectionsInitialized = true;
    } catch (error) {
        console.error('Failed to initialize database connections:', error);
        throw error;
    }
};

// Ensure connection is established before any operation
const connect = async () => {
    await initializeConnections();
    return connectToDatabase();
};

// Disconnect from all databases
const disconnect = async () => {
    try {
        await connectToDatabase().close();
        await getUsersDb().close();
        await getAdminDb().close();
        await getInternalDb().close();
        console.log('All database connections closed');
    } catch (e) {
        console.error('Error closing database connections:', e);
    }
};

export const db = {
    // --- Invoices ---
    getInvoices: async (user, filters = {}, options = {}) => {
        // Extract options with defaults
        const { includeFiles = false } = options;

        try {
            await connect();
            let query = {};

            // RBAC Filtering
            if (user) {
                const role = getNormalizedRole(user);

                if (role === ROLES.PROJECT_MANAGER) {
                    // Check for projects delegated TO this user
                    const delegators = await Users.find({
                        delegatedTo: user.id,
                        delegationExpiresAt: { $gt: new Date() }
                    });
                    const delegatedProjectIds = delegators.flatMap(u => u.assignedProjects || []);

                    // PMs see invoices for their assigned projects OR explicitly assigned to them OR delegated projects
                    query.$or = [
                        { project: { $in: [...(user.assignedProjects || []), ...delegatedProjectIds] } },
                        { assignedPM: user.id }
                    ];
                } else if (role === ROLES.VENDOR) {
                    // Vendors only see their own invoices - strict ID matching only
                    // Name-based matching removed for security (vendorName can be spoofed)
                    query.submittedByUserId = user.id;
                } else if (role === ROLES.DEPARTMENT_HEAD) {
                    // Dept Head sees:
                    // 1. Invoices explicitly assigned to them
                    // 2. Invoices already actioned by them (approved/rejected)
                    // 3. Unassigned invoices from their PMs that are pending dept head review
                    const myPMs = await Users.find({ managedBy: user.id }).select('id').lean();
                    const myPMIds = myPMs.map(u => u.id);
                    const DEPT_HEAD_STATUSES = [
                        'Pending Dept Head Review',
                        'Dept Head Rejected',
                        'Pending Div Head Review',
                        'Div Head Approved',
                        'Div Head Rejected',
                    ];
                    if (myPMIds.length > 0) {
                        query.$or = [
                            { assignedDeptHead: user.id },
                            { 'deptHeadApproval.approvedBy': user.id },
                            // Fallback: unassigned invoices from managed PMs in dept-head stage only
                            {
                                assignedPM: { $in: myPMIds },
                                assignedDeptHead: { $in: [null, '', undefined] },
                                status: { $in: DEPT_HEAD_STATUSES }
                            }
                        ];
                    } else {
                        query.assignedDeptHead = user.id;
                    }
                } else if (role === ROLES.DIVISIONAL_HEAD) {
                    // Div Head sees:
                    // 1. Invoices explicitly assigned to them
                    // 2. Invoices already actioned by them (approved/rejected)
                    // 3. Fallback: unassigned invoices from their dept-heads in div-head stage
                    const myDeptHeads = await Users.find({ managedBy: user.id }).select('id').lean();
                    const myDeptHeadIds = myDeptHeads.map(u => u.id);
                    const DIV_HEAD_STATUSES = [
                        'Pending Div Head Review',
                        'Div Head Approved',
                        'Div Head Rejected',
                    ];
                    if (myDeptHeadIds.length > 0) {
                        query.$or = [
                            { assignedDivHead: user.id },
                            { 'divHeadApproval.approvedBy': user.id },
                            // Fallback: unassigned invoices from managed dept-heads in div-head stage only
                            {
                                assignedDeptHead: { $in: myDeptHeadIds },
                                assignedDivHead: { $in: [null, '', undefined] },
                                status: { $in: DIV_HEAD_STATUSES }
                            }
                        ];
                    } else {
                        query.assignedDivHead = user.id;
                    }

                } else if (role === ROLES.ADMIN) {
                    // Admins see all invoices for system oversight
                } else {
                    // Unknown/Unauthorized role -> return empty
                    return [];
                }
            } else {
                // Strict Security: No user context provided -> return empty
                // This prevents accidental leaks if callers forget to pass user
                console.warn("db.getInvoices called without user context - returning empty array");
                return [];
            }

            let findQuery = Invoice.find(query);

            // Apply projection if we want to exclude large fields (optimize list views)
            if (!includeFiles) {
                findQuery = findQuery.select('-fileUrl -documents');
            }

            const invoices = await findQuery.sort({ created_at: -1 });
            const list = invoices.map(doc => {
                // Backward compatibility: some older invoices may have status "PM Approved"
                // but an empty pmApproval object. Normalize so UI sees them as approved.
                // Normalize PM Approval based on overall status
                const pmApprovedStatuses = ['PM Approved', 'Pending Finance Review', 'Finance Approved', 'Finance Rejected'];
                const normalizedPmApproval = (doc.pmApproval && doc.pmApproval.status && doc.pmApproval.status !== 'PENDING')
                    ? (typeof doc.pmApproval.toObject === 'function' ? doc.pmApproval.toObject() : doc.pmApproval)
                    : (pmApprovedStatuses.includes(doc.status)
                        ? {
                            status: 'APPROVED',
                            approvedBy: doc.pmApproval?.approvedBy || null,
                            approvedByRole: doc.pmApproval?.approvedByRole || ROLES.PROJECT_MANAGER,
                            approvedAt: doc.pmApproval?.approvedAt || doc.updated_at,
                            notes: doc.pmApproval?.notes || null,
                            approvedByName: doc.pmApprovedByName || null
                        }
                        : (typeof doc.pmApproval?.toObject === 'function' ? doc.pmApproval.toObject() : doc.pmApproval));

                // Normalize Finance Approval based on overall status
                const normalizedFinanceApproval = (doc.financeApproval && doc.financeApproval.status && doc.financeApproval.status !== 'PENDING')
                    ? (typeof doc.financeApproval.toObject === 'function' ? doc.financeApproval.toObject() : doc.financeApproval)
                    : (doc.status === 'Finance Approved'
                        ? {
                            status: 'APPROVED',
                            approvedBy: doc.financeApproval?.approvedBy || null,
                            approvedByRole: doc.financeApproval?.approvedByRole || ROLES.FINANCE_USER,
                            approvedAt: doc.financeApproval?.approvedAt || doc.updated_at,
                            notes: doc.financeApproval?.notes || null,
                            approvedByName: doc.financeApproval?.approvedByName || null
                        }
                        : (typeof doc.financeApproval?.toObject === 'function' ? doc.financeApproval.toObject() : doc.financeApproval));

                return {
                    id: doc.id,
                    vendorName: doc.vendorName,
                    submittedByUserId: doc.submittedByUserId,
                    vendorId: doc.vendorId,
                    originalName: doc.originalName,
                    receivedAt: doc.receivedAt,
                    invoiceNumber: doc.invoiceNumber,
                    date: doc.date,
                    invoiceDate: doc.invoiceDate,
                    amount: doc.amount,
                    basicAmount: doc.basicAmount,
                    taxType: doc.taxType,
                    hsnCode: doc.hsnCode,
                    status: doc.status,
                    category: doc.category,
                    dueDate: doc.dueDate,
                    costCenter: doc.costCenter,
                    accountCode: doc.accountCode,
                    currency: doc.currency,
                    fileUrl: includeFiles ? doc.fileUrl : null,
                    poNumber: doc.poNumber,
                    project: doc.project,
                    billingMonth: doc.billingMonth || (doc.invoiceDate || doc.date ? (doc.invoiceDate || doc.date).substring(0, 7) : null),
                    matching: doc.matching,
                    // Approval / workflow fields exposed to UI
                    assignedPM: doc.assignedPM,
                    pmApproval: normalizedPmApproval,
                    financeApproval: normalizedFinanceApproval,
                    assignedFinanceUser: doc.assignedFinanceUser,
                    assignedDeptHead: doc.assignedDeptHead,
                    assignedDivHead: doc.assignedDivHead,
                    deptHeadApproval: doc.deptHeadApproval ? (typeof doc.deptHeadApproval.toObject === 'function' ? doc.deptHeadApproval.toObject() : doc.deptHeadApproval) : null,
                    divHeadApproval: doc.divHeadApproval ? (typeof doc.divHeadApproval.toObject === 'function' ? doc.divHeadApproval.toObject() : doc.divHeadApproval) : null,
                    hilReview: doc.hilReview,
                    documents: includeFiles ? doc.documents : null,
                    lineItems: doc.lineItems || [], // Include lineItems
                    created_at: doc.created_at
                };
            });

            // Enrich with vendorCode and PM/user names for Admin/PM/DeptHead/DivHead/Finance
            if (user && [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD, ROLES.FINANCE_USER].includes(user.role)) {
                const userIds = [...new Set(list.map(inv => inv.submittedByUserId).filter(Boolean))];
                const assignedPmIds = [...new Set(list.map(inv => inv.assignedPM).filter(Boolean))];
                const assignedFinanceUserIds = [...new Set(list.map(inv => inv.assignedFinanceUser).filter(Boolean))];
                const approverIds = [...new Set(list.map(inv => inv.pmApproval?.approvedBy).filter(Boolean))];
                const allUserIdsForNames = [...new Set([...userIds, ...assignedPmIds, ...assignedFinanceUserIds, ...approverIds])];
                const vendorIdsFromInvoices = [...new Set(list.map(inv => inv.vendorId).filter(Boolean))];
                let userToVendor = {};
                let userNameById = {};
                if (allUserIdsForNames.length) {
                    const users = await Users.find({ id: { $in: allUserIdsForNames } }).select('id vendorId name').lean();
                    userToVendor = Object.fromEntries(users.map(u => [u.id, u.vendorId]).filter(([, v]) => v));
                    userNameById = Object.fromEntries(users.map(u => [u.id, u.name]));
                }
                const allVendorIds = [...new Set([...vendorIdsFromInvoices, ...Object.values(userToVendor)])].filter(Boolean);
                let vendorCodeByVendorId = {};
                if (allVendorIds.length) {
                    const vendors = await Vendor.find({ id: { $in: allVendorIds } }).lean();
                    vendors.forEach(v => {
                        const code = v.vendorCode || ('ve-' + String((v.id || '').replace(/^v-/, '') || '1').padStart(3, '0'));
                        vendorCodeByVendorId[v.id] = code;
                    });
                }
                list.forEach(inv => {
                    const vid = inv.vendorId || userToVendor[inv.submittedByUserId];
                    inv.vendorCode = vid ? (vendorCodeByVendorId[vid] || null) : null;
                    if (inv.assignedPM) {
                        inv.assignedPMName = userNameById[inv.assignedPM] || null;
                    }
                    if (inv.assignedFinanceUser) {
                        inv.assignedFinanceUserName = userNameById[inv.assignedFinanceUser] || null;
                    }
                    if (inv.pmApproval?.approvedBy) {
                        inv.pmApprovedByName = userNameById[inv.pmApproval.approvedBy] || null;
                    }
                });
            }

            return list;
        } catch (e) {
            console.error("Failed to fetch invoices from MongoDB", e);
            return [];
        }
    },

    getInvoice: async (id, requestingUser = null) => {
        try {
            await connect();
            const doc = await Invoice.findOne({ id });
            if (!doc) return null;

            // Normalize PM Approval based on overall status
            const pmApprovedStatuses = ['PM Approved', 'Pending Finance Review', 'Finance Approved', 'Finance Rejected'];
            const normalizedPmApproval = (doc.pmApproval && doc.pmApproval.status && doc.pmApproval.status !== 'PENDING')
                ? (typeof doc.pmApproval.toObject === 'function' ? doc.pmApproval.toObject() : doc.pmApproval)
                : (pmApprovedStatuses.includes(doc.status)
                    ? {
                        status: 'APPROVED',
                        approvedBy: doc.pmApproval?.approvedBy || null,
                        approvedByRole: doc.pmApproval?.approvedByRole || ROLES.PROJECT_MANAGER,
                        approvedAt: doc.pmApproval?.approvedAt || doc.updated_at,
                        notes: doc.pmApproval?.notes || null
                    }
                    : (typeof doc.pmApproval?.toObject === 'function' ? doc.pmApproval.toObject() : doc.pmApproval));

            // Normalize Finance Approval based on overall status
            const normalizedFinanceApproval = (doc.financeApproval && doc.financeApproval.status && doc.financeApproval.status !== 'PENDING')
                ? (typeof doc.financeApproval.toObject === 'function' ? doc.financeApproval.toObject() : doc.financeApproval)
                : (doc.status === 'Finance Approved'
                    ? {
                        status: 'APPROVED',
                        approvedBy: doc.financeApproval?.approvedBy || null,
                        approvedByRole: doc.financeApproval?.approvedByRole || ROLES.FINANCE_USER,
                        approvedAt: doc.financeApproval?.approvedAt || doc.updated_at,
                        notes: doc.financeApproval?.notes || null
                    }
                    : (typeof doc.financeApproval?.toObject === 'function' ? doc.financeApproval.toObject() : doc.financeApproval));

            const inv = {
                id: doc.id,
                vendorName: doc.vendorName,
                submittedByUserId: doc.submittedByUserId,
                vendorId: doc.vendorId,
                originalName: doc.originalName,
                receivedAt: doc.receivedAt,
                invoiceNumber: doc.invoiceNumber,
                date: doc.date,
                invoiceDate: doc.invoiceDate,
                amount: doc.amount,
                basicAmount: doc.basicAmount,
                taxType: doc.taxType,
                hsnCode: doc.hsnCode,
                status: doc.status,
                category: doc.category,
                dueDate: doc.dueDate,
                costCenter: doc.costCenter,
                accountCode: doc.accountCode,
                currency: doc.currency,
                fileUrl: doc.fileUrl,
                poNumber: doc.poNumber,
                project: doc.project,
                billingMonth: doc.billingMonth,
                matching: doc.matching,
                assignedPM: doc.assignedPM,
                pmApproval: normalizedPmApproval,
                financeApproval: normalizedFinanceApproval,
                assignedFinanceUser: doc.assignedFinanceUser,
                assignedDeptHead: doc.assignedDeptHead,
                assignedDivHead: doc.assignedDivHead,
                deptHeadApproval: doc.deptHeadApproval ? (typeof doc.deptHeadApproval.toObject === 'function' ? doc.deptHeadApproval.toObject() : doc.deptHeadApproval) : null,
                divHeadApproval: doc.divHeadApproval ? (typeof doc.divHeadApproval.toObject === 'function' ? doc.divHeadApproval.toObject() : doc.divHeadApproval) : null,
                hilReview: doc.hilReview,
                documents: doc.documents,
                lineItems: doc.lineItems || [],
                created_at: doc.created_at
            };
            // Resolve PM and Finance User names + approval names
            const userIdsToResolve = [
                inv.assignedPM,
                inv.assignedFinanceUser,
                inv.pmApproval?.approvedBy,
                inv.financeApproval?.approvedBy
            ].filter(Boolean);
            if (userIdsToResolve.length > 0) {
                const users = await Users.find({ id: { $in: [...new Set(userIdsToResolve)] } }).select('id name').lean();
                const nameById = {};
                users.forEach(u => { nameById[u.id] = u.name; });
                if (inv.assignedPM) inv.assignedPMName = nameById[inv.assignedPM] || null;
                if (inv.assignedFinanceUser) inv.assignedFinanceUserName = nameById[inv.assignedFinanceUser] || null;
                // Backfill approvedByName if missing (for older approvals)
                if (inv.pmApproval?.approvedBy && !inv.pmApproval.approvedByName) {
                    inv.pmApproval = { ...inv.pmApproval, approvedByName: nameById[inv.pmApproval.approvedBy] || null };
                }
                if (inv.financeApproval?.approvedBy && !inv.financeApproval.approvedByName) {
                    inv.financeApproval = { ...inv.financeApproval, approvedByName: nameById[inv.financeApproval.approvedBy] || null };
                }
            }

            // Resolve missing fileName in documents array from DocumentUpload collection
            if (inv.documents && inv.documents.length > 0) {
                const docsWithoutName = inv.documents.filter(d => !d.fileName && d.documentId);
                if (docsWithoutName.length > 0) {
                    const docIds = docsWithoutName.map(d => d.documentId);
                    const docRecords = await DocumentUpload.find({ id: { $in: docIds } }).select('id fileName').lean();
                    const fileNameById = {};
                    docRecords.forEach(d => { fileNameById[d.id] = d.fileName; });
                    inv.documents = inv.documents.map(d => ({
                        ...d,
                        fileName: d.fileName || fileNameById[d.documentId] || d.documentId
                    }));
                }
            }

            if (requestingUser && [ROLES.ADMIN, ROLES.PROJECT_MANAGER, ROLES.FINANCE_USER, ROLES.DEPARTMENT_HEAD, ROLES.DIVISIONAL_HEAD].includes(requestingUser.role)) {
                const vid = inv.vendorId;
                if (!vid && inv.submittedByUserId) {
                    const u = await Users.findOne({ id: inv.submittedByUserId }).select('vendorId').lean();
                    if (u?.vendorId) inv.vendorId = u.vendorId;
                }
                const resolvedVendorId = inv.vendorId;
                if (resolvedVendorId) {
                    const vDoc = await Vendor.findOne({ id: resolvedVendorId }).lean();
                    const code = vDoc?.vendorCode || (resolvedVendorId ? 've-' + String(resolvedVendorId).replace(/^v-/, '').padStart(3, '0') : null);
                    inv.vendorCode = code;
                } else inv.vendorCode = null;
            }
            return inv;
        } catch (e) {
            console.error(`Failed to fetch invoice ${id}`, e);
            return null;
        }
    },

    saveInvoice: async (id, data) => {
        try {
            await connect();
            const existing = await Invoice.findOne({ id });
            const previousStatus = existing?.status;

            const updateData = {
                id,
                vendorName: data.vendorName || existing?.vendorName || 'Pending Identification',
                submittedByUserId: data.submittedByUserId ?? existing?.submittedByUserId,
                vendorId: data.vendorId !== undefined ? data.vendorId : existing?.vendorId,
                originalName: data.originalName,
                receivedAt: data.receivedAt ? new Date(data.receivedAt) : undefined,
                invoiceNumber: data.invoiceNumber,
                date: data.date,
                invoiceDate: data.invoiceDate,
                amount: data.amount,
                basicAmount: data.basicAmount,
                taxType: data.taxType,
                hsnCode: data.hsnCode,
                status: data.status,
                category: data.category,
                dueDate: data.dueDate,
                costCenter: data.costCenter,
                accountCode: data.accountCode,
                currency: data.currency || 'INR',
                fileUrl: data.fileUrl,
                poNumber: data.poNumber,
                project: data.project,
                billingMonth: data.billingMonth,
                matching: data.matching,
                // Approval / workflow fields
                assignedPM: data.assignedPM !== undefined ? data.assignedPM : existing?.assignedPM,
                assignedFinanceUser: data.assignedFinanceUser !== undefined ? data.assignedFinanceUser : existing?.assignedFinanceUser,
                assignedDeptHead: data.assignedDeptHead !== undefined ? data.assignedDeptHead : existing?.assignedDeptHead,
                assignedDivHead: data.assignedDivHead !== undefined ? data.assignedDivHead : existing?.assignedDivHead,
                pmApproval: data.pmApproval !== undefined ? data.pmApproval : existing?.pmApproval,
                financeApproval: data.financeApproval !== undefined ? data.financeApproval : existing?.financeApproval,
                deptHeadApproval: data.deptHeadApproval !== undefined ? data.deptHeadApproval : existing?.deptHeadApproval,
                divHeadApproval: data.divHeadApproval !== undefined ? data.divHeadApproval : existing?.divHeadApproval,
                hilReview: data.hilReview !== undefined ? data.hilReview : existing?.hilReview,
                documents: data.documents !== undefined ? data.documents : existing?.documents,
                lineItems: data.lineItems !== undefined ? data.lineItems : existing?.lineItems, // Support lineItems update
                // NOTE: auditTrail is intentionally NOT set here.
                // It is only updated via the atomic $push below to avoid overwriting
                // entries that may have been added concurrently.
            };
            // Remove undefined so we don't overwrite with null
            Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

            const doc = await Invoice.findOneAndUpdate(
                { id },
                updateData,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            // Create audit entry using provided data or fallback to existing system
            // If comprehensive audit data provided, use it; otherwise use legacy system
            if (data.auditTrailEntry) {
                // Add comprehensive audit entry to invoice's auditTrail array
                await Invoice.findOneAndUpdate(
                    { id },
                    { $push: { auditTrail: data.auditTrailEntry } }
                );
            } else if (data.status && (previousStatus !== data.status)) {
                // Legacy audit trail for backward compatibility (RBAC: Admin has "Audit log access and review")
                await AuditTrail.create({
                    invoice_id: id,
                    username: data.auditUsername || 'System',
                    action: data.auditAction || 'UPDATE',
                    details: data.auditDetails || `Status updated from ${previousStatus} to ${data.status}`,
                    role: data.auditRole,
                    timestamp: new Date()
                });
            }

            return {
                id: doc.id,
                vendorName: doc.vendorName,
                submittedByUserId: doc.submittedByUserId,
                originalName: doc.originalName,
                receivedAt: doc.receivedAt,
                invoiceNumber: doc.invoiceNumber,
                date: doc.date,
                invoiceDate: doc.invoiceDate,
                amount: doc.amount,
                basicAmount: doc.basicAmount,
                taxType: doc.taxType,
                hsnCode: doc.hsnCode,
                status: doc.status,
                category: doc.category,
                dueDate: doc.dueDate,
                costCenter: doc.costCenter,
                accountCode: doc.accountCode,
                currency: doc.currency,
                fileUrl: doc.fileUrl,
                poNumber: doc.poNumber,
                project: doc.project,
                billingMonth: doc.billingMonth,
                matching: doc.matching,
                assignedPM: doc.assignedPM,
                assignedFinanceUser: doc.assignedFinanceUser,
                assignedDeptHead: doc.assignedDeptHead,
                assignedDivHead: doc.assignedDivHead,
                pmApproval: doc.pmApproval,
                financeApproval: doc.financeApproval,
                deptHeadApproval: doc.deptHeadApproval,
                divHeadApproval: doc.divHeadApproval,
                hilReview: doc.hilReview,
                documents: doc.documents,
                lineItems: doc.lineItems || [],
                created_at: doc.created_at
            };
        } catch (e) {
            console.error(`Failed to save invoice ${id}`, e);
            throw e;
        }
    },

    deleteInvoice: async (id) => {
        try {
            await connect();
            await Invoice.deleteOne({ id });
        } catch (e) {
            console.error(`Failed to delete invoice ${id}`, e);
            throw e;
        }
    },

    // --- Vendors ---
    getVendor: async (id) => {
        try {
            await connect();
            const doc = await Vendor.findOne({ id });
            if (!doc) return null;
            const obj = doc.toObject();
            if (!obj.vendorCode && obj.id) obj.vendorCode = 've-' + String((obj.id || '').replace(/^v-/, '') || '1').padStart(3, '0');
            return obj;
        } catch (e) {
            console.error(`Failed to fetch vendor ${id}`, e);
            return null;
        }
    },

    getAllVendors: async () => {
        try {
            await connect();
            const vendors = await Vendor.find({}).sort({ name: 1 });
            return vendors.map(v => {
                const obj = v.toObject();
                if (!obj.vendorCode && obj.id) obj.vendorCode = 've-' + String((obj.id || '').replace(/^v-/, '') || '1').padStart(3, '0');
                return obj;
            });
        } catch (e) {
            console.error("Failed to fetch vendors", e);
            return [];
        }
    },

    createVendor: async (vendor) => {
        try {
            await connect();
            // Check if vendor already exists to preserve its vendorCode
            const existing = await Vendor.findOne({ id: vendor.id }).select('vendorCode').lean();
            if (existing?.vendorCode) {
                vendor.vendorCode = existing.vendorCode;
            } else if (!vendor.vendorCode) {
                const last = await Vendor.findOne().sort({ vendorCode: -1 }).select('vendorCode').lean();
                let next = 1;
                if (last?.vendorCode) {
                    const n = parseInt(String(last.vendorCode).replace(/^ve-/, ''), 10);
                    if (!isNaN(n)) next = n + 1;
                }
                vendor.vendorCode = 've-' + String(next).padStart(3, '0');
            }
            const doc = await Vendor.findOneAndUpdate(
                { id: vendor.id },
                vendor,
                { upsert: true, new: true }
            );
            return doc.toObject();
        } catch (e) {
            console.error("Failed to create vendor", e);
            throw e;
        }
    },

    // --- Purchase Orders ---
    getPurchaseOrder: async (poNumber) => {
        try {
            await connect();
            const po = await PurchaseOrder.findOne({ poNumber });
            if (!po) return null;

            // Fetch Vendor Name (mock join)
            const vendor = await Vendor.findOne({ id: po.vendorId });

            return {
                ...po.toObject(),
                vendorName: vendor ? vendor.name : 'Unknown Vendor',
                items: po.items // Already embedded
            };
        } catch (e) {
            console.error(`Failed to fetch PO ${poNumber}`, e);
            return null;
        }
    },

    createPurchaseOrder: async (po) => {
        try {
            await connect();
            const doc = await PurchaseOrder.findOneAndUpdate(
                { id: po.id },
                {
                    ...po,
                    items: po.items // Embedded array maps directly
                },
                { upsert: true, new: true }
            );
            return doc.toObject();
        } catch (e) {
            console.error("Failed to create PO", e);
            throw e;
        }
    },

    // --- Annexures ---
    getAnnexureByPO: async (poId) => {
        try {
            await connect();
            const doc = await Annexure.findOne({ poId });
            return doc ? doc.toObject() : null;
        } catch (e) {
            console.error(`Failed to fetch annexure for PO ${poId}`, e);
            return null;
        }
    },

    createAnnexure: async (annexure) => {
        try {
            await connect();
            const doc = await Annexure.findOneAndUpdate(
                { id: annexure.id },
                annexure,
                { upsert: true, new: true }
            );
            return doc.toObject();
        } catch (e) {
            console.error("Failed to create annexure", e);
            throw e;
        }
    },

    // --- Users ---

    deleteUser: async (id) => {
        try {
            await connect();
            await Users.deleteOne({ id });
            return true;
        } catch (e) {
            console.error(`Failed to delete user ${id}`, e);
            throw e;
        }
    },

    updateUserVendorId: async (userId, vendorId) => {
        try {
            await connect();
            const doc = await Users.findOneAndUpdate(
                { id: userId },
                { $set: { vendorId } },
                { new: true }
            );
            return doc ? doc.toObject() : null;
        } catch (e) {
            console.error(`Failed to update vendorId for user ${userId}`, e);
            throw e;
        }
    },

    getAllUsers: async () => {
        try {
            await connect();
            const users = await Users.find({}).sort({ created_at: -1 });
            const vendorIds = [...new Set(users.map(u => u.vendorId).filter(Boolean))];
            const vendors = vendorIds.length ? await Vendor.find({ id: { $in: vendorIds } }).lean() : [];
            const vendorById = Object.fromEntries(vendors.map(v => {
                const o = { ...v };
                if (!o.vendorCode && o.id) o.vendorCode = 've-' + String((o.id || '').replace(/^v-/, '') || '1').padStart(3, '0');
                return [o.id, o];
            }));
            return users.map(user => {
                const u = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    assignedProjects: user.assignedProjects || [],
                    vendorId: user.vendorId,
                    managedBy: user.managedBy || null,
                    isActive: user.isActive
                };
                if (user.vendorId && vendorById[user.vendorId]) u.vendorCode = vendorById[user.vendorId].vendorCode;
                return u;
            });
        } catch (e) {
            console.error("Failed to fetch all users", e);
            return [];
        }
    },

    // --- Hierarchy Helpers ---
    /**
     * Find all PM User IDs associated with a vendor through projects
     * This enables rate card cascading: when a rate card is assigned to a vendor,
     * it automatically cascades to all PMs managing projects with that vendor
     * @param {string} vendorId - The vendor ID
     * @returns {string[]} Array of PM user IDs
     */
    getPMsForVendor: async (vendorId) => {
        try {
            await connect();
            // Find all projects that have this vendor in their vendorIds array
            const projects = await Project.find({
                vendorIds: vendorId,
                status: { $ne: 'ARCHIVED' }
            }).select('assignedPMs').lean();

            // Collect all unique PM IDs from these projects
            const pmIds = new Set();
            projects.forEach(project => {
                if (project.assignedPMs && Array.isArray(project.assignedPMs)) {
                    project.assignedPMs.forEach(pmId => pmIds.add(pmId));
                }
            });

            return Array.from(pmIds);
        } catch (e) {
            console.error(`Failed to fetch PMs for vendor ${vendorId}`, e);
            return [];
        }
    },

    getUsersByRole: async (role) => {
        try {
            await connect();
            const users = await Users.find({ role, isActive: { $ne: false } }).sort({ name: 1 });
            return users.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                managedBy: u.managedBy || null
            }));
        } catch (e) {
            console.error(`Failed to fetch users by role: ${role}`, e);
            return [];
        }
    },

    updateUserManagedBy: async (userId, managedBy) => {
        try {
            await connect();
            const doc = await Users.findOneAndUpdate(
                { id: userId },
                { $set: { managedBy: managedBy || null } },
                { new: true }
            );
            return doc ? { id: doc.id, name: doc.name, role: doc.role, managedBy: doc.managedBy } : null;
        } catch (e) {
            console.error(`Failed to update managedBy for user ${userId}`, e);
            throw e;
        }
    },

    getVendorsForProjects: async (projectIds) => {
        try {
            await connect();
            if (!projectIds || projectIds.length === 0) return [];

            const projects = await Project.find({ id: { $in: projectIds } });
            const vendorIds = [...new Set(projects.flatMap(p => p.vendorIds || []))];

            if (vendorIds.length === 0) return [];

            const vendors = await Vendor.find({ id: { $in: vendorIds } });
            return vendors.map(v => ({
                id: v.id,
                name: v.name,
                email: v.email,
                linkedUserId: v.linkedUserId,
                status: v.status
            }));
        } catch (e) {
            console.error("Failed to fetch vendors for projects", e);
            return [];
        }
    },

    /**
     * Find the Project Manager for a Department Head or Divisional Head
     * Traverses the managedBy chain to find the PM
     * @param {string} userId - User ID of Dept Head or Div Head
     * @returns {string|null} PM user ID or null if not found
     */
    getPMForUser: async (userId) => {
        try {
            await connect();
            const user = await Users.findOne({ id: userId }).select('id role managedBy').lean();
            if (!user) return null;

            // If already a PM, return own ID
            if (user.role === ROLES.PROJECT_MANAGER || user.role === 'PM') return user.id;

            // If Dept Head, find the PM they're managed by (legacy/simple mapping)
            // or find PMs they manage
            if ((user.role === ROLES.DEPARTMENT_HEAD || user.role === 'Department Head') && user.managedBy) {
                // Check if managedBy is a PM
                const mgr = await Users.findOne({ id: user.managedBy }).select('id role').lean();
                if (mgr && (mgr.role === ROLES.PROJECT_MANAGER || mgr.role === 'PM')) return mgr.id;
            }

            // If Div Head, find the Dept Head first, then the PM
            if ((user.role === ROLES.DIVISIONAL_HEAD || user.role === 'Divisional Head') && user.managedBy) {
                const deptHead = await Users.findOne({ id: user.managedBy }).select('managedBy role').lean();
                if (deptHead && deptHead.managedBy) {
                    const pm = await Users.findOne({ id: deptHead.managedBy }).select('id role').lean();
                    if (pm && (pm.role === ROLES.PROJECT_MANAGER || pm.role === 'PM')) return pm.id;
                }
            }

            return null;
        } catch (e) {
            console.error(`Failed to find PM for user ${userId}`, e);
            return null;
        }
    },

    /**
     * Find all PM IDs under a Dept Head or Div Head's hierarchy
     * @param {string} userId - User ID
     * @param {string} role - User role
     * @returns {string[]} Array of PM user IDs
     */
    getPMsManagedByUser: async (userId, role) => {
        try {
            await connect();
            if (role === ROLES.PROJECT_MANAGER || role === 'PM') return [userId];

            if (role === ROLES.DEPARTMENT_HEAD || role === 'Department Head') {
                const myPMs = await Users.find({
                    managedBy: userId,
                    role: { $in: [ROLES.PROJECT_MANAGER, 'PM'] }
                }).select('id').lean();
                return myPMs.map(u => u.id);
            }

            if (role === ROLES.DIVISIONAL_HEAD || role === 'Divisional Head') {
                // Get Dept Heads managed by this Div Head
                const myDeptHeads = await Users.find({
                    managedBy: userId,
                    role: { $in: [ROLES.DEPARTMENT_HEAD, 'Department Head'] }
                }).select('id').lean();
                const deptHeadIds = myDeptHeads.map(u => u.id);

                // Get PMs managed by those Dept Heads
                const myPMs = await Users.find({
                    managedBy: { $in: deptHeadIds },
                    role: { $in: [ROLES.PROJECT_MANAGER, 'PM'] }
                }).select('id').lean();
                return myPMs.map(u => u.id);
            }

            return [];
        } catch (e) {
            console.error(`Failed to fetch managed PMs for ${userId}`, e);
            return [];
        }
    },

    // --- Audit Trail ---
    createAuditTrailEntry: async (entry) => {
        try {
            await connect();

            // Bug fix: always use the correctly bound model (admin db), not the broken proxy ref
            const AuditTrailModel = getAuditTrailModel();

            const payload = {
                username: entry.username,
                action: entry.action,
                details: entry.details
            };

            // Only include invoice_id if it has a value
            if (entry.invoice_id) {
                payload.invoice_id = entry.invoice_id;
            }
            if (entry.role) payload.role = entry.role;
            if (entry.timestamp) payload.timestamp = new Date(entry.timestamp);

            await AuditTrailModel.create(payload);
        } catch (e) {
            // Log but don't fail the request if audit trail fails
            console.error("Failed to create audit trail entry (non-fatal):", e.message);
        }
    },

    getAuditTrail: async (invoiceId) => {
        try {
            await connect();
            // Read from the embedded auditTrail array on the Invoice document
            // (the workflow route writes here via $push; the legacy AuditTrail
            // collection in admin DB is no longer the source of truth)
            const invoice = await Invoice.findOne({ id: invoiceId }).select('auditTrail').lean();
            if (!invoice) return [];
            const logs = (invoice.auditTrail || []).slice().sort(
                (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
            );
            return logs;
        } catch (e) {
            console.error("Failed to fetch audit trail", e);
            return [];
        }
    },

    getAllAuditLogs: async (limit = 100) => {
        try {
            await connect();
            // Aggregate audit entries from all invoice embedded auditTrail arrays
            const invoices = await Invoice.find(
                { 'auditTrail.0': { $exists: true } },
                { id: 1, invoiceNumber: 1, auditTrail: 1 }
            ).lean();
            const embeddedLogs = [];
            for (const inv of invoices) {
                for (const entry of (inv.auditTrail || [])) {
                    embeddedLogs.push({
                        action: (entry.action || 'UPDATE').toUpperCase(),
                        username: entry.actor,
                        actor: entry.actor,
                        actorId: entry.actorId,
                        actorRole: entry.actorRole,
                        timestamp: entry.timestamp,
                        previousStatus: entry.previousStatus,
                        newStatus: entry.newStatus,
                        notes: entry.notes,
                        details: entry.notes,
                        invoice_id: inv.id,
                        invoiceNumber: inv.invoiceNumber
                    });
                }
            }
            // Also include legacy standalone AuditTrail entries (not mirrored to embedded)
            const AuditTrailModel = getAuditTrailModel();
            const standalone = await AuditTrailModel.find({}).lean();
            const standaloneLogs = standalone.map(l => ({
                action: l.action,
                username: l.username,
                actor: l.username,
                timestamp: l.timestamp,
                notes: l.details,
                details: l.details,
                invoice_id: l.invoice_id,
                actorRole: l.role || null
            }));
            const allLogs = [...embeddedLogs, ...standaloneLogs];
            allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            return allLogs.slice(0, limit);
        } catch (e) {
            console.error("Failed to fetch all audit logs", e);
            return [];
        }
    },

    // --- Notifications (email log) ---
    createNotification: async (entry) => {
        try {
            await connect();
            const doc = await Notification.create({
                recipient_email: entry.recipient_email,
                subject: entry.subject,
                message: entry.message,
                status: entry.status || 'SENT',
                sent_at: entry.sent_at ? new Date(entry.sent_at) : undefined,
                related_entity_id: entry.related_entity_id,
                notification_type: entry.notification_type
            });
            return doc.toObject();
        } catch (e) {
            console.error("Failed to create notification log", e);
            throw e;
        }
    },

    getNotifications: async ({ relatedEntityId = null, limit = 50 } = {}) => {
        try {
            await connect();
            const query = relatedEntityId ? { related_entity_id: relatedEntityId } : {};
            const list = await Notification.find(query).sort({ sent_at: -1 }).limit(limit);
            return list.map(n => n.toObject());
        } catch (e) {
            console.error("Failed to fetch notifications", e);
            return [];
        }
    },

    // --- Delegation ---
    getDelegation: async (username) => {
        try {
            await connect();
            const doc = await Delegation.findOne({ delegate_from: username, active: true });
            return doc ? doc.toObject() : null;
        } catch (e) {
            console.error("Failed to get delegation", e);
            return null;
        }
    },

    setDelegation: async (from, to) => {
        try {
            await connect();
            // Deactivate old
            await Delegation.updateMany(
                { delegate_from: from, active: true },
                { active: false }
            );
            // Create new
            await Delegation.create({
                delegate_from: from,
                delegate_to: to,
                active: true
            });
        } catch (e) {
            console.error("Failed to set delegation", e);
            throw e;
        }
    },

    // --- System Health ---
    testConnection: async () => {
        try {
            await connect();
            const mongoose = (await import('mongoose')).default;

            // basic state check
            if (mongoose.connection.readyState !== 1) {
                return false;
            }

            // Verify actual read access (more robust than admin ping)
            // Use User model to check if we can read from the main collection
            await Users.findOne().select('_id').lean();

            return true;
        } catch (e) {
            console.error("DB connection test failed", e);
            throw e;
        }
    },

    // --- System Configuration ---
    getSystemConfig: async () => {
        try {
            await connect();
            const adminDb = getAdminDb();
            const configCollection = adminDb.collection('system_config');
            const config = await configCollection.findOne({ _id: 'global' });
            return config || null;
        } catch (e) {
            console.error("Failed to fetch system config", e);
            return null;
        }
    },

    saveSystemConfig: async (data) => {
        try {
            await connect();
            const adminDb = getAdminDb();
            const configCollection = adminDb.collection('system_config');

            const result = await configCollection.findOneAndUpdate(
                { _id: 'global' },
                { $set: { ...data, _id: 'global' } },
                { upsert: true, returnDocument: 'after' }
            );

            return result.value || result;
        } catch (e) {
            console.error("Failed to save system config", e);
            throw e;
        }
    },

    // --- Data Integrity Helpers ---
    /**
     * Synchronize Project Manager assignments between User and Project models
     * Ensures both User.assignedProjects and Project.assignedPMs are updated consistently
     * @param {string} userId - The ID of the user whose assignments are being updated
     * @param {string[]} projectIds - Array of project IDs the user is assigned to
     * @returns {boolean} - Success/failure status
     */
    syncPMAssignments: async (userId, projectIds) => {
        try {
            await connect();
            // 1. Update User's assignedProjects array
            await Users.findOneAndUpdate({ id: userId }, { $set: { assignedProjects: projectIds } });

            // 2. Remove user from all projects they are NOT assigned to anymore
            await Project.updateMany(
                { assignedPMs: userId, id: { $nin: projectIds } },
                { $pull: { assignedPMs: userId } }
            );

            // 3. Add user to all projects they ARE now assigned to
            await Project.updateMany(
                { id: { $in: projectIds } },
                { $addToSet: { assignedPMs: userId } }
            );

            return true;
        } catch (e) {
            console.error("Failed to sync PM assignments", e);
            return false;
        }
    },

    /**
     * Legacy alias for syncPMAssignments - kept for backward compatibility
     */
    syncProjectAssignments: async (userId, projectIds) => {
        return db.syncPMAssignments(userId, projectIds);
    },

    // --- Users ---
    createUser: async (data) => {
        try {
            await connect();
            const updateData = {
                id: data.id,
                name: data.name,
                email: data.email.trim().toLowerCase(),
                passwordHash: data.passwordHash,
                role: data.role,
                assignedProjects: data.assignedProjects || [],
                vendorId: data.vendorId || null,
                managedBy: data.managedBy || null,
                isActive: data.isActive !== false,
            };
            // Remove undefined to avoid overwriting with null
            Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

            const doc = await Users.findOneAndUpdate(
                { email: updateData.email },
                updateData,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            return {
                id: doc.id,
                name: doc.name,
                email: doc.email,
                role: doc.role,
                assignedProjects: doc.assignedProjects,
                vendorId: doc.vendorId,
                managedBy: doc.managedBy || null,
                isActive: doc.isActive,
            };
        } catch (e) {
            console.error('Failed to create user', e);
            throw e;
        }
    },

    getUserByEmail: async (email) => {
        try {
            await connect();
            const doc = await Users.findOne({ email: email.trim().toLowerCase() });
            if (!doc) return null;
            return {
                id: doc.id,
                name: doc.name,
                email: doc.email,
                password_hash: doc.passwordHash, // Map for login route compatibility
                role: doc.role,
                assignedProjects: doc.assignedProjects,
                vendorId: doc.vendorId,
                managedBy: doc.managedBy || null,
                isActive: doc.isActive,
            };
        } catch (e) {
            console.error('Failed to get user by email', e);
            return null;
        }
    },

    getUserById: async (id) => {
        try {
            await connect();
            const doc = await Users.findOne({ id });
            if (!doc) return null;
            return {
                id: doc.id,
                name: doc.name,
                email: doc.email,
                password_hash: doc.passwordHash, // Map for update route compatibility
                role: doc.role,
                assignedProjects: doc.assignedProjects,
                vendorId: doc.vendorId,
                managedBy: doc.managedBy || null,
                isActive: doc.isActive,
            };
        } catch (e) {
            console.error('Failed to get user by id', e);
            return null;
        }
    },

    getUsers: async (filters = {}) => {
        try {
            await connect();
            const query = {};
            if (filters.role) query.role = filters.role;
            if (filters.isActive !== undefined) query.isActive = filters.isActive;

            const docs = await Users.find(query).sort({ created_at: -1 });
            return docs.map(doc => ({
                id: doc.id,
                name: doc.name,
                email: doc.email,
                role: doc.role,
                assignedProjects: doc.assignedProjects,
                vendorId: doc.vendorId,
                managedBy: doc.managedBy || null,
                isActive: doc.isActive,
                created_at: doc.created_at,
            }));
        } catch (e) {
            console.error('Failed to get users', e);
            return [];
        }
    },
};

// Export database functions and model access helpers
export {
    connect,
    disconnect,
    getUsersDb,
    getAdminDb,
    getInternalDb,
    getUsersModel,
    getVendorModel,
    getProjectModel,
    getPurchaseOrderModel,
    getRateCardModel,
    getDelegationModel,
    getAuditTrailModel,
    getOtpModel,
    getDocumentUploadModel,
    getNotificationModel,
    getMessageModel,
    getAnnexureModel,
    getInvoiceModel,
};
