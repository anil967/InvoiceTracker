/**
 * Seed All Test Credentials with Hierarchy
 * Run with: node scripts/seed-all-credentials.mjs
 *
 * THIS SCRIPT WILL:
 * 1. Remove ALL old users except the 14 test credential users
 * 2. Create/update all 14 credential users
 * 3. Set up the full hierarchy chain
 *
 * Hierarchy: Admin -> Finance Users -> Project Managers -> Vendors
 *   Admin (admin@company.com)
 *     ├── Finance User 1 (finance.user1@company.com)
 *     │     ├── PM-Sales       -> TechNova, BluePeak, Meridian
 *     │     └── PM-Marketing   -> Apex, Stellar, Crestline
 *     └── Finance User 2 (finance.user2@company.com)
 *           └── PM-Operations  -> Horizon, NexBridge
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('❌ MONGODB_URI not found in .env'); process.exit(1); }

// ── Schema ──
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

const VendorSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    vendorCode: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    linkedUserId: { type: String },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);

// ── Stable IDs ──
const IDS = {
    admin: 'admin-001',
    fu1: 'fu-001',
    fu2: 'fu-002',
    pmSales: 'pm-sales-001',
    pmMarketing: 'pm-marketing-001',
    pmOperations: 'pm-operations-001',
    vTechNova: 'v-technova',
    vBluePeak: 'v-bluepeak',
    vMeridian: 'v-meridian',
    vApex: 'v-apex',
    vStellar: 'v-stellar',
    vCrestline: 'v-crestline',
    vHorizon: 'v-horizon',
    vNexBridge: 'v-nexbridge',
};

// The ONLY valid emails — anything else gets cleaned
const VALID_EMAILS = [
    'admin@company.com',
    'finance.user1@company.com',
    'finance.user2@company.com',
    'pm.sales@company.com',
    'pm.marketing@company.com',
    'pm.operations@company.com',
    'vendor@technovasolutions.com',
    'vendor@blupeakent.com',
    'vendor@meridianglobal.com',
    'vendor@apexdigitalworks.com',
    'vendor@stellarsupplies.com',
    'vendor@crestlineind.com',
    'vendor@horizontradegroup.com',
    'vendor@nexbridgepartners.com',
];

const users = [
    // ── Admin ──
    { id: IDS.admin, name: 'Admin', email: 'admin@company.com', password: 'Admin@Secure2025', role: 'Admin', managedBy: null },

    // ── Finance Users (managed by Admin) ──
    { id: IDS.fu1, name: 'Finance User 1', email: 'finance.user1@company.com', password: 'Finance@U12025', role: 'Finance User', managedBy: IDS.admin },
    { id: IDS.fu2, name: 'Finance User 2', email: 'finance.user2@company.com', password: 'Finance@U22025', role: 'Finance User', managedBy: IDS.admin },

    // ── Project Managers (managed by Finance Users) ──
    { id: IDS.pmSales, name: 'PM-Sales', email: 'pm.sales@company.com', password: 'PM@Sales2025', role: 'PM', managedBy: IDS.fu1, assignedProjects: ['Sales'] },
    { id: IDS.pmMarketing, name: 'PM-Marketing', email: 'pm.marketing@company.com', password: 'PM@Mktg2025', role: 'PM', managedBy: IDS.fu1, assignedProjects: ['Marketing'] },
    { id: IDS.pmOperations, name: 'PM-Operations', email: 'pm.operations@company.com', password: 'PM@Ops2025', role: 'PM', managedBy: IDS.fu2, assignedProjects: ['Operations'] },

    // ── Vendors (managed by PMs) ──
    { id: IDS.vTechNova, name: 'TechNova Solutions', email: 'vendor@technovasolutions.com', password: 'Vendor@TN2025', role: 'Vendor', managedBy: IDS.pmSales, vendorId: 'v-technova', vendorCode: 'VEN-TN' },
    { id: IDS.vBluePeak, name: 'BluePeak Enterprises', email: 'vendor@blupeakent.com', password: 'Vendor@BP2025', role: 'Vendor', managedBy: IDS.pmSales, vendorId: 'v-bluepeak', vendorCode: 'VEN-BP' },
    { id: IDS.vMeridian, name: 'Meridian Global Corp', email: 'vendor@meridianglobal.com', password: 'Vendor@MG2025', role: 'Vendor', managedBy: IDS.pmSales, vendorId: 'v-meridian', vendorCode: 'VEN-MG' },
    { id: IDS.vApex, name: 'Apex Digital Works', email: 'vendor@apexdigitalworks.com', password: 'Vendor@AD2025', role: 'Vendor', managedBy: IDS.pmMarketing, vendorId: 'v-apex', vendorCode: 'VEN-AD' },
    { id: IDS.vStellar, name: 'Stellar Supplies Co.', email: 'vendor@stellarsupplies.com', password: 'Vendor@SS2025', role: 'Vendor', managedBy: IDS.pmMarketing, vendorId: 'v-stellar', vendorCode: 'VEN-SS' },
    { id: IDS.vCrestline, name: 'Crestline Industries', email: 'vendor@crestlineind.com', password: 'Vendor@CI2025', role: 'Vendor', managedBy: IDS.pmMarketing, vendorId: 'v-crestline', vendorCode: 'VEN-CI' },
    { id: IDS.vHorizon, name: 'Horizon Trade Group', email: 'vendor@horizontradegroup.com', password: 'Vendor@HT2025', role: 'Vendor', managedBy: IDS.pmOperations, vendorId: 'v-horizon', vendorCode: 'VEN-HT' },
    { id: IDS.vNexBridge, name: 'NexBridge Partners', email: 'vendor@nexbridgepartners.com', password: 'Vendor@NB2025', role: 'Vendor', managedBy: IDS.pmOperations, vendorId: 'v-nexbridge', vendorCode: 'VEN-NB' },
];

async function seed() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.\n');

        // ── Step 1: Clean old users ──
        console.log('🧹 Cleaning old users...');
        const deleteResult = await User.deleteMany({ email: { $nin: VALID_EMAILS } });
        console.log(`   Removed ${deleteResult.deletedCount} old users.\n`);

        // Also clean old vendor records
        const validVendorIds = Object.values(IDS).filter(id => id.startsWith('v-'));
        const vendorDeleteResult = await Vendor.deleteMany({ id: { $nin: validVendorIds } });
        console.log(`   Removed ${vendorDeleteResult.deletedCount} old vendor records.\n`);

        // ── Step 2: Create/update all 14 users ──
        console.log('👥 Seeding users...');
        const created = { users: 0, vendors: 0, updated: 0 };

        for (const u of users) {
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(u.password, salt);

            // Delete any existing user with this email to avoid conflicts (then re-create)
            await User.deleteMany({ email: u.email });

            await User.create({
                id: u.id,
                name: u.name,
                email: u.email,
                passwordHash,
                role: u.role,
                managedBy: u.managedBy || null,
                assignedProjects: u.assignedProjects || [],
                vendorId: u.vendorId || null,
                isActive: true,
            });
            console.log(`   ✅ ${u.role.padEnd(14)} ${u.name.padEnd(22)} ${u.email}`);
            created.users++;

            // Create vendor record if applicable
            if (u.role === 'Vendor' && u.vendorId) {
                await Vendor.deleteMany({ id: u.vendorId });
                await Vendor.create({
                    id: u.vendorId,
                    vendorCode: u.vendorCode,
                    name: u.name,
                    email: u.email,
                    linkedUserId: u.id,
                    status: 'ACTIVE',
                });
                created.vendors++;
                console.log(`      🏢 Vendor: ${u.vendorCode} - ${u.name}`);
            }
        }

        console.log('\n══════════════════════════════════════════');
        console.log('✅ Seeding Complete!');
        console.log(`   Users: ${created.users} | Vendors: ${created.vendors}`);
        console.log('══════════════════════════════════════════');
        console.log('\n📋 Hierarchy:');
        console.log('   Admin');
        console.log('   ├── Finance User 1');
        console.log('   │     ├── PM-Sales       → TechNova, BluePeak, Meridian');
        console.log('   │     └── PM-Marketing   → Apex, Stellar, Crestline');
        console.log('   └── Finance User 2');
        console.log('         └── PM-Operations  → Horizon, NexBridge');

        process.exit(0);
    } catch (e) {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    }
}

seed();
