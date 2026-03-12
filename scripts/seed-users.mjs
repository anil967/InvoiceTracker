/**
 * Standalone Seed Users Script
 * Run with: node scripts/seed-users.mjs
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

// --- Data ---
const users = [
    // Admin
    { name: 'Test Admin', email: 'admin@test.com', password: 'admin@test.com', role: ROLES.ADMIN },

    // Finance Users
    { name: 'John', email: 'john@gmail.com', password: 'john@gmail.com', role: ROLES.FINANCE_USER },
    { name: 'Robin', email: 'sam@gmail.com', password: 'sam@gmail.com', role: ROLES.FINANCE_USER },

    // Project Managers
    { name: 'Sundar', email: 'sp@gmail.com', password: 'sp@gmail.com', role: ROLES.PROJECT_MANAGER, assignedProjects: ['Project Alpha'] },
    { name: 'Derby', email: 'derby@gmail.com', password: 'derby@gmail.com', role: ROLES.PROJECT_MANAGER, assignedProjects: ['Cloud Migration'] },
    { name: 'Lubber', email: 'lubber@gmail.com', password: 'lubber@gmail.com', role: ROLES.PROJECT_MANAGER, assignedProjects: ['Internal Tooling'] },

    // Vendors
    { name: 'Jonnathan', email: 'jonny@gmail.com', password: 'jonny@gmail.com', role: ROLES.VENDOR, vendorId: 'v-jonny', vendorCode: 'VEN-001' },
    { name: 'Rooh', email: 'rooh@gmail.com', password: 'rooh@gmail.com', role: ROLES.VENDOR, vendorId: 'v-rooh', vendorCode: 'VEN-002' },
    { name: 'Jack', email: 'jack@gmail.com', password: 'jack@gmail.com', role: ROLES.VENDOR, vendorId: 'v-jack', vendorCode: 'VEN-003' },
    { name: 'Rony', email: 'rony@gmail.com', password: 'rony@gmail.com', role: ROLES.VENDOR, vendorId: 'v-rony', vendorCode: 'VEN-004' },
    { name: 'Kapa', email: 'kapa@gmail.com', password: 'kapa@gmail.com', role: ROLES.VENDOR, vendorId: 'v-kapa', vendorCode: 'VEN-005' },
    { name: 'Rohan', email: 'rohan@gmail.com', password: 'rohan@gmail.com', role: ROLES.VENDOR, vendorId: 'v-rohan', vendorCode: 'VEN-006' },
    { name: 'Ram', email: 'ram@gmail.com', password: 'ram@gmail.com', role: ROLES.VENDOR, vendorId: 'v-ram', vendorCode: 'VEN-007' },
    { name: 'Sita', email: 'sita@gmail.com', password: 'sita@gmail.com', role: ROLES.VENDOR, vendorId: 'v-sita', vendorCode: 'VEN-008' }
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
                 userDoc.assignedProjects = u.assignedProjects || [];
                 userDoc.vendorId = u.vendorId || null;
                 await userDoc.save();
                 console.log(`👤 Updated User: ${u.email}`);
             } else {
                 userDoc = await User.create({
                     id: uuidv4(),
                     name: u.name,
                     email: u.email,
                     passwordHash,
                     role: u.role,
                     assignedProjects: u.assignedProjects || [],
                     vendorId: u.vendorId || null,
                     isActive: true
                 });
                 console.log(`👤 Created User: ${u.email}`);
             }

             // 2. If Vendor, Create/Update Vendor Record
             if (u.role === ROLES.VENDOR && u.vendorId) {
                 let vendorDoc = await Vendor.findOne({ id: u.vendorId });
                 if (vendorDoc) {
                     vendorDoc.name = u.name; // Keep name synced
                     vendorDoc.email = u.email;
                     vendorDoc.vendorCode = u.vendorCode; // Ensure code is synced
                     vendorDoc.linkedUserId = userDoc.id;
                     await vendorDoc.save();
                     console.log(`   🏢 Updated Vendor: ${u.vendorId}`);
                 } else {
                     await Vendor.create({
                         id: u.vendorId,
                         vendorCode: u.vendorCode,
                         name: u.name,
                         email: u.email,
                         linkedUserId: userDoc.id,
                         status: 'ACTIVE'
                     });
                     console.log(`   🏢 Created Vendor: ${u.vendorId}`);
                 }
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
