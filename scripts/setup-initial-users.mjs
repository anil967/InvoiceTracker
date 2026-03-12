/**
 * Setup Initial Users Script - Creates login credentials for all key roles
 * Run with: node scripts/setup-initial-users.mjs
 *
 * This script creates/updates initial users in MongoDB for Admin, PM, Finance User, and Vendor roles.
 * All users use the same default password for easy initial setup.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env');
}

// Role constants
const ROLES = {
    ADMIN: 'Admin',
    PROJECT_MANAGER: 'PM',
    FINANCE_USER: 'Finance User',
    VENDOR: 'Vendor'
};

// Define schemas
const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true },
    assignedProjects: { type: [String], default: () => [] },
    vendorId: { type: String },
    isActive: { type: Boolean, default: true },
    permissions: { type: [String], default: () => [] },
    lastLogin: { type: Date },
    profileImage: { type: String },
    department: { type: String }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const VendorSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    contactPerson: { type: String },
    linkedUserId: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Create models
const User = mongoose.model('User', UserSchema);
const Vendor = mongoose.model('vendors', VendorSchema);

const DEFAULT_PASSWORD = 'Password123!'; // Default password for all initial users

const users = [
    {
        id: 'u-admin-initial',
        name: 'Admin',
        email: 'admin@gmail.com',
        role: ROLES.ADMIN,
        assignedProjects: [],
        vendorId: null,
        department: 'Administration'
    },
    {
        id: 'u-pm-initial',
        name: 'Project Manager',
        email: 'pm@gmail.com',
        role: ROLES.PROJECT_MANAGER,
        assignedProjects: [],
        vendorId: null,
        department: 'Operations'
    },
    {
        id: 'u-finance-initial',
        name: 'Finance User',
        email: 'fu@gmail.com',
        role: ROLES.FINANCE_USER,
        assignedProjects: [],
        vendorId: null,
        department: 'Finance'
    },
    {
        id: 'u-vendor-initial',
        name: 'Vendor',
        email: 'vendor@gmail.com',
        role: ROLES.VENDOR,
        assignedProjects: [],
        vendorId: null,
        department: 'Vendor'
    }
];

async function setupInitialUsers() {
    try {
        console.log('🔐 Setting up initial users...\n');

        // Connect to MongoDB directly
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Hash password using bcrypt
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, salt);

        const results = {
            created: [],
            updated: [],
            errors: []
        };

        console.log('Processing each user...\n');

        for (const userData of users) {
            try {
                // Find existing user
                const existing = await User.findOne({ email: userData.email });

                if (existing) {
                    // Update existing user
                    await User.findOneAndUpdate(
                        { email: userData.email },
                        {
                            ...userData,
                            passwordHash: passwordHash  // Always reset to default password
                        },
                        { upsert: true, new: true }
                    );
                    results.updated.push({
                        email: userData.email,
                        role: userData.role,
                        name: userData.name
                    });
                    console.log(`✅ Updated: ${userData.email} (${userData.role})`);
                } else {
                    // For Vendor role, create a Vendor record first
                    let vendorId = null;
                    if (userData.role === ROLES.VENDOR) {
                        const vendorIdShort = 'v-' + userData.id.slice(0, 8);
                        const vendorRecord = await Vendor.findOneAndUpdate(
                            { id: vendorIdShort },
                            {
                                id: vendorIdShort,
                                name: userData.name,
                                email: userData.email.toLowerCase(),
                                linkedUserId: userData.id,
                            },
                            { upsert: true, new: true }
                        );
                        vendorId = vendorRecord.id;
                        console.log(`   📦 Created vendor record: ${vendorId}`);
                    }

                    // Create new user
                    await User.create({
                        ...userData,
                        passwordHash: passwordHash,
                        vendorId: vendorId || userData.vendorId
                    });
                    results.created.push({
                        email: userData.email,
                        role: userData.role,
                        name: userData.name,
                        vendorId: vendorId || userData.vendorId
                    });
                    console.log(`✨ Created: ${userData.email} (${userData.role})`);
                }
            } catch (error) {
                console.error(`❌ Error processing ${userData.email}:`, error.message);
                results.errors.push({
                    email: userData.email,
                    error: error.message
                });
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log('📊 Summary:');
        console.log('='.repeat(70));
        console.log(`   ✅ Created: ${results.created.length}`);
        console.log(`   🔄 Updated: ${results.updated.length}`);
        console.log(`   ❌ Errors:   ${results.errors.length}`);

        if (results.errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            results.errors.forEach(err => {
                console.log(`   - ${err.email}: ${err.error}`);
            });
        }

        console.log('\n' + '='.repeat(70));
        console.log('🔑 Login Credentials:');
        console.log('='.repeat(70));
        console.log(`   Role                | Email                        | Password`);
        console.log('─'.repeat(70));
        users.forEach(u => {
            console.log(`   ${u.role.padEnd(20)} | ${u.email.padEnd(28)} | ${DEFAULT_PASSWORD}`);
        });
        console.log('─'.repeat(70));

        console.log('\n📝 Next Steps:');
        console.log('   1. Log in to the portal with each of the credentials above');
        console.log('   2. Verify that all users can access their respective dashboards');
        console.log('   3. Check the users collection in MongoDB to ensure records are correct');
        console.log('   4. ⚠️  Remember to change passwords in production!\n');

        // Close connection
        await mongoose.connection.close();

        if (results.errors.length === 0) {
            console.log('✅ Initial users setup completed successfully!\n');
            process.exit(0);
        } else {
            console.log('⚠️  Setup completed with some errors. Check the error list above.\n');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Fatal error setting up initial users:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

setupInitialUsers();