
import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local or .env');
}

// Minimal Schema for Project
const ProjectSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    ringiNumber: { type: String },
    description: { type: String },
    status: {
        type: String,
        enum: ['ACTIVE', 'COMPLETED', 'ARCHIVED'],
        default: 'ACTIVE'
    },
    assignedPMs: [{ type: String }],  // Array of user IDs
    vendorIds: [{ type: String }],     // Associated vendor IDs
    billingMonth: { type: String },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);

const projects = [
    {
        id: 'p-001',
        name: 'Metropolis Redesign',
        ringiNumber: 'RNG-2024-001',
        description: 'Complete overhaul of the Metropolis UI/UX',
        status: 'ACTIVE',
        assignedPMs: ['u-pm-01', 'u-pm-03'], // Matches u-pm-01 and u-pm-03
        vendorIds: ['v-001'],     // Matches u-vendor-01's vendorId
        billingMonth: 'October 2024'
    },
    {
        id: 'p-002',
        name: 'Cloud Migration',
        ringiNumber: 'RNG-2024-002',
        description: 'Migration of legacy systems to Cloud',
        status: 'ACTIVE',
        assignedPMs: ['u-pm-01', 'u-pm-02'], // Matches u-pm-01 and u-pm-02
        vendorIds: ['v-001'],
        billingMonth: 'November 2024'
    }
];

async function seedProjects() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected');

        console.log('🏗️ Seeding projects...');

        for (const p of projects) {
            const existing = await Project.findOne({ id: p.id });
            if (existing) {
                // Update
                existing.name = p.name;
                existing.ringiNumber = p.ringiNumber;
                existing.assignedPMs = p.assignedPMs;
                existing.vendorIds = p.vendorIds;
                existing.status = p.status;
                await existing.save();
                console.log(`Updated Project: ${p.name}`);
            } else {
                await Project.create(p);
                console.log(`Created Project: ${p.name}`);
            }
        }

        console.log('✨ Project Seeding Completed!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

seedProjects();
