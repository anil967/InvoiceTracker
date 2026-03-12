
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local or .env');
}

// Minimal Schema Definitions to avoid import issues
const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true },
    assignedProjects: { type: [String], default: [] },
    vendorId: { type: String },
    isActive: { type: Boolean, default: true },
    permissions: { type: [String], default: [] },
    lastLogin: { type: Date },
    profileImage: { type: String },
    department: { type: String },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

const ROLES = {
    ADMIN: 'Admin',
    PROJECT_MANAGER: 'PM',
    FINANCE_USER: 'Finance User',
    VENDOR: 'Vendor'
};

const DEFAULT_PASSWORD = 'Password123!';

const users = [
    {
        id: 'u-admin-01',
        name: 'System Admin',
        email: 'admin@invoiceflow.com',
        role: ROLES.ADMIN,
        assignedProjects: [],
        vendorId: null,
        department: 'IT'
    },
    {
        id: 'u-finance-01',
        name: 'Finance User',
        email: 'financeuser@invoiceflow.com',
        role: ROLES.FINANCE_USER,
        assignedProjects: [],
        vendorId: null,
        department: 'Finance'
    },
    {
        id: 'u-pm-01',
        name: 'Project Manager',
        email: 'pm@invoiceflow.com',
        role: ROLES.PROJECT_MANAGER,
        assignedProjects: ['Project Alpha', 'Cloud Migration'],
        vendorId: null,
        department: 'Operations'
    },
    {
        id: 'u-pm-02',
        name: 'Sarah Connor',
        email: 'sarah.connor@invoiceflow.com',
        role: ROLES.PROJECT_MANAGER,
        assignedProjects: ['Cloud Migration'],
        vendorId: null,
        department: 'Operations'
    },
    {
        id: 'u-pm-03',
        name: 'John Smith',
        email: 'john.smith@invoiceflow.com',
        role: ROLES.PROJECT_MANAGER,
        assignedProjects: ['Metropolis Redesign'],
        vendorId: null,
        department: 'Engineering'
    },
    {
        id: 'u-vendor-01',
        name: 'Acme Solutions',
        email: 'vendor@acme.com',
        role: ROLES.VENDOR,
        assignedProjects: [],
        vendorId: 'v-001',
        department: 'Vendor'
    }
];

async function seed() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected');

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, salt);

        console.log('🔐 Seeding users...');

        for (const u of users) {
            const existing = await User.findOne({ email: u.email });
            if (existing) {
                // Update, resetting password to default for testing
                existing.name = u.name;
                existing.role = u.role;
                existing.passwordHash = passwordHash;
                existing.assignedProjects = u.assignedProjects;
                existing.vendorId = u.vendorId;
                await existing.save();
                console.log(`Updated: ${u.email}`);
            } else {
                await User.create({
                    ...u,
                    passwordHash
                });
                console.log(`Created: ${u.email}`);
            }
        }

        console.log('✨ Done! All users have password:', DEFAULT_PASSWORD);
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

seed();
