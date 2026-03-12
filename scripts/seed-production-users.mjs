/**
 * Production Seed Users Script
 * Populates the database with the users provided by the user.
 * Run with: node scripts/seed-production-users.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

// --- Constants ---
const ROLES = {
    ADMIN: 'ADMIN',
    FINANCE_USER: 'FINANCE_USER',
    PROJECT_MANAGER: 'PROJECT_MANAGER',
    VENDOR: 'VENDOR'
};

// --- Models ---
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
    department: { type: String },
    managedBy: { type: String },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

const VendorSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    vendorCode: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    linkedUserId: { type: String },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);

const users = [
    // Vendors
    { name: 'TechNova Solutions', email: 'vendor@technovasolutions.com', password: 'Vendor@TN2025', role: ROLES.VENDOR, vendorCode: 'VEN-001' },
    { name: 'BluePeak Enterprises', email: 'vendor@blupeakent.com', password: 'Vendor@BP2025', role: ROLES.VENDOR, vendorCode: 'VEN-002' },
    { name: 'Meridian Global Corp', email: 'vendor@meridianglobal.com', password: 'Vendor@MG2025', role: ROLES.VENDOR, vendorCode: 'VEN-003' },
    { name: 'Apex Digital Works', email: 'vendor@apexdigitalworks.com', password: 'Vendor@AD2025', role: ROLES.VENDOR, vendorCode: 'VEN-004' },
    { name: 'Stellar Supplies Co.', email: 'vendor@stellarsupplies.com', password: 'Vendor@SS2025', role: ROLES.VENDOR, vendorCode: 'VEN-005' },
    { name: 'Crestline Industries', email: 'vendor@crestlineind.com', password: 'Vendor@CI2025', role: ROLES.VENDOR, vendorCode: 'VEN-006' },
    { name: 'Horizon Trade Group', email: 'vendor@horizontradegroup.com', password: 'Vendor@HT2025', role: ROLES.VENDOR, vendorCode: 'VEN-007' },
    { name: 'NexBridge Partners', email: 'vendor@nexbridgepartners.com', password: 'Vendor@NB2025', role: ROLES.VENDOR, vendorCode: 'VEN-008' },

    // Project Managers
    { name: 'PM-Sales', email: 'pm.sales@company.com', password: 'PM@Sales2025', role: ROLES.PROJECT_MANAGER },
    { name: 'PM-Marketing', email: 'pm.marketing@company.com', password: 'PM@Mktg2025', role: ROLES.PROJECT_MANAGER },
    { name: 'PM-Operations', email: 'pm.operations@company.com', password: 'PM@Ops2025', role: ROLES.PROJECT_MANAGER },

    // Finance Users
    { name: 'Finance User 1', email: 'finance.user1@company.com', password: 'Finance@U12025', role: ROLES.FINANCE_USER },
    { name: 'Finance User 2', email: 'finance.user2@company.com', password: 'Finance@U22025', role: ROLES.FINANCE_USER },

    // Admin
    { name: 'Admin', email: 'admin@company.com', password: 'Admin@Secure2025', role: ROLES.ADMIN }
];

async function seed() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        for (const u of users) {
             const salt = await bcrypt.genSalt(10);
             const passwordHash = await bcrypt.hash(u.password, salt);
             
             // 1. Create/Update User
             let userDoc = await User.findOne({ email: u.email });
             if (userDoc) {
                 userDoc.name = u.name;
                 userDoc.passwordHash = passwordHash;
                 userDoc.role = u.role;
                 await userDoc.save();
                 console.log(`👤 Updated User: ${u.email}`);
             } else {
                 userDoc = await User.create({
                     id: uuidv4(),
                     name: u.name,
                     email: u.email,
                     passwordHash,
                     role: u.role,
                     isActive: true
                 });
                 console.log(`👤 Created User: ${u.email}`);
             }

             // 2. If Vendor, Create/Update Vendor Record
             if (u.role === ROLES.VENDOR) {
                 const vendorId = 'v-' + u.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
                 let vendorDoc = await Vendor.findOne({ id: vendorId });
                 if (vendorDoc) {
                     vendorDoc.name = u.name;
                     vendorDoc.email = u.email;
                     vendorDoc.vendorCode = u.vendorCode;
                     vendorDoc.linkedUserId = userDoc.id;
                     await vendorDoc.save();
                     console.log(`   🏢 Updated Vendor: ${vendorId}`);
                 } else {
                     await Vendor.create({
                         id: vendorId,
                         vendorCode: u.vendorCode,
                         name: u.name,
                         email: u.email,
                         linkedUserId: userDoc.id,
                         status: 'ACTIVE'
                     });
                     console.log(`   🏢 Created Vendor: ${vendorId}`);
                 }
                 
                 // Link vendorId back to user
                 userDoc.vendorId = vendorId;
                 await userDoc.save();
             }
        }

        console.log('\n✅ Seeding Complete.');
        process.exit(0);

    } catch (e) {
        console.error('❌ Seeding Failed:', e);
        process.exit(1);
    }
}

seed();
