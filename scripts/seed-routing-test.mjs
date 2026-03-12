
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local or .env');
}

// --- Schemas ---
const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    role: { type: String, required: true },
    assignedProjects: [{ type: String }],
    vendorId: { type: String },
    department: { type: String },
    isActive: { type: Boolean, default: true }
});

const ProjectSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    status: { type: String, default: 'ACTIVE' },
    assignedPMs: [{ type: String }],
    vendorIds: [{ type: String }],
    billingMonth: { type: String },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);

const DEFAULT_PASSWORD = 'Password123!';

async function seedRoutingTest() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected');

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, salt);

        // --- Data ---
        const users = [
            {
                id: 'u-pm-alex',
                name: 'Alex (PM)',
                email: 'pm_alex@invoiceflow.com',
                role: 'PROJECT_MANAGER',
                assignedProjects: ['p-alex'], // Matches Project ID assignment
                department: 'Engineering'
            },
            {
                id: 'u-pm-sarah',
                name: 'Sarah (PM)',
                email: 'pm_sarah@invoiceflow.com',
                role: 'PROJECT_MANAGER',
                assignedProjects: ['p-sarah'], // Matches Project ID assignment
                department: 'Product'
            }
        ];

        const projects = [
            {
                id: 'p-alex',
                name: 'Proton Upgrade',
                description: 'Infrastructure upgrade project managed by Alex',
                assignedPMs: ['u-pm-alex'],
                vendorIds: ['v-001']
            },
            {
                id: 'p-sarah',
                name: 'Neutron Deployment',
                description: 'New precision deployment system managed by Sarah',
                assignedPMs: ['u-pm-sarah'],
                vendorIds: ['v-001']
            }
        ];

        // --- Execution ---
        console.log('\n🏗️ Seeding Users...');
        for (const u of users) {
            await User.findOneAndUpdate(
                { email: u.email },
                {
                    ...u,
                    password_hash: passwordHash,
                    isActive: true
                },
                { upsert: true, new: true }
            );
            console.log(`   User: ${u.name} (${u.email})`);
        }

        console.log('\n🏗️ Seeding Projects...');
        for (const p of projects) {
            await Project.findOneAndUpdate(
                { id: p.id },
                p,
                { upsert: true, new: true }
            );
            console.log(`   Project: ${p.name}`);
        }

        console.log('\n✅ Seeding Complete!');
        console.log('\n🔑 Credentials (Password: ' + DEFAULT_PASSWORD + ')');
        console.log('   - pm_alex@invoiceflow.com');
        console.log('   - pm_sarah@invoiceflow.com');

        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

seedRoutingTest();
