require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true },
    assignedProjects: { type: [String], default: [] },
    vendorId: { type: String },
    isActive: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const VendorSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    vendorCode: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    linkedUserId: { type: String },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

async function seed() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected.");

        const User = mongoose.models.User || mongoose.model('User', UserSchema);
        const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', VendorSchema);

        const passwordHash = await bcrypt.hash('Password123!', 10);

        const dummyUsers = [
            {
                id: 'u-admin-1',
                name: 'Admin User',
                email: 'admin@example.com',
                passwordHash,
                role: 'Admin'
            },
            {
                id: 'u-pm-1',
                name: 'PM User',
                email: 'pm@example.com',
                passwordHash,
                role: 'PM',
                assignedProjects: ['Project X']
            },
            {
                id: 'u-finance-1',
                name: 'Finance User',
                email: 'finance@example.com',
                passwordHash,
                role: 'Finance User'
            },
            {
                id: 'u-vendor-1',
                name: 'Vendor User',
                email: 'vendor@example.com',
                passwordHash,
                role: 'Vendor',
                vendorId: 'v-vendor-1'
            }
        ];

        for (const u of dummyUsers) {
            await User.findOneAndUpdate({ email: u.email }, u, { upsert: true, new: true });
            console.log(`Seeded user: ${u.email} (${u.role})`);
        }

        const dummyVendor = {
            id: 'v-vendor-1',
            vendorCode: 'VE-001',
            name: 'Acme Corp',
            email: 'vendor@example.com',
            linkedUserId: 'u-vendor-1',
            status: 'ACTIVE'
        };

        await Vendor.findOneAndUpdate({ id: dummyVendor.id }, dummyVendor, { upsert: true, new: true });
        console.log(`Seeded vendor: ${dummyVendor.name} (${dummyVendor.vendorCode})`);

        console.log("\nSeeding completed successfully!");
        console.log("Credentials: Email as listed, Password: Password123!");

    } catch (error) {
        console.error("Error during seeding:", error);
    } finally {
        await mongoose.connection.close();
    }
}

seed();
