import mongoose from 'mongoose';
import { getUsersDb } from '../lib/mongodb';

/**
 * User Model - Users collection in users database
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
            const db = getUsersDb();
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
            const db = getUsersDb();
            if (db) {
                const model = db.models[modelName] || db.model(modelName, schema);
                return new model(...args);
            }
            return new (mongoose.models[modelName])(...args);
        }
    });
}

const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Keeping custom ID for consistency
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true },
    assignedProjects: { type: [String], default: [] }, // For Project Managers
    vendorId: { type: String }, // For Vendors (optional linkage)
    // New RBAC fields
    isActive: { type: Boolean, default: true }, // For user deactivation
    permissions: { type: [String], default: [] }, // Granular permissions override
    lastLogin: { type: Date },
    profileImage: { type: String },
    department: { type: String },
    // Hierarchy
    managedBy: { type: String }, // User ID of the manager (Admin->FU->PM->Vendor)
    // Delegation
    delegatedTo: { type: String }, // User ID of the delegate
    delegationExpiresAt: { type: Date },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'users' // Explicitly set collection name
});

// Indexes for efficient queries (email already indexed via unique: true)
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ managedBy: 1 });

// Export proxy instead of static model
export default createModelProxy('Users', UserSchema);