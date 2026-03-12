/**
 * Seed Admin Credential
 * Run with: node scripts/seed-admin.mjs
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
    managedBy: { type: String },
    delegatedTo: { type: String },
    delegationExpiresAt: { type: Date },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function seedAdmin() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        const email = 'admin@company.com';
        const password = 'Admin@Secure2025';
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        let adminDoc = await User.findOne({ email });

        if (adminDoc) {
            adminDoc.name = 'Admin';
            adminDoc.passwordHash = passwordHash;
            adminDoc.role = 'ADMIN';
            adminDoc.isActive = true;
            await adminDoc.save();
            console.log(`👤 Updated admin: ${email}`);
        } else {
            await User.create({
                id: uuidv4(),
                name: 'Admin',
                email,
                passwordHash,
                role: 'ADMIN',
                isActive: true,
            });
            console.log(`👤 Created admin: ${email}`);
        }

        console.log('\n✅ Admin seeding complete.');
        console.log(`   Email:    ${email}`);
        console.log(`   Password: ${password}`);
        process.exit(0);
    } catch (e) {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    }
}

seedAdmin();
