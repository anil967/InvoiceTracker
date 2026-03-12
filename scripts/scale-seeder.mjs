/**
 * Scaling Seeder (Updated)
 * Creates 1 Admin, 2 Finance Users, 6 PMs, and 24 Vendors.
 * Run with: node scripts/scale-seeder.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const MONGODB_URI = process.env.MONGODB_URI;

const ROLES = {
    ADMIN: 'Admin',
    PROJECT_MANAGER: 'PM',
    FINANCE_USER: 'Finance User',
    VENDOR: 'Vendor'
};

const UserSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: String,
    email: { type: String, unique: true },
    passwordHash: String,
    role: String,
    managedBy: String,
    isActive: { type: Boolean, default: true }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function seed() {
    try {
        console.log('Connecting to:', MONGODB_URI.split('@')[1]); // Log host only for safety
        await mongoose.connect(MONGODB_URI);
        
        console.log('🧹 Clearing ALL existing users...');
        const deleteRes = await User.deleteMany({});
        console.log(`🗑️ Deleted ${deleteRes.deletedCount} users.`);

        const passwordHash = await bcrypt.hash('Secure@123', 10);

        // 1. Admin
        const adminId = uuidv4();
        await User.create({
            id: adminId,
            name: 'System Admin',
            email: 'admin@company.com',
            passwordHash,
            role: ROLES.ADMIN
        });
        console.log('👑 Created Admin: admin@company.com');

        let totalCreated = 1;

        // 2. Finance Users
        for (let i = 1; i <= 2; i++) {
            const fuId = uuidv4();
            await User.create({
                id: fuId,
                name: `Finance User ${i}`,
                email: `finance${i}@company.com`,
                passwordHash,
                role: ROLES.FINANCE_USER,
                managedBy: adminId
            });
            console.log(`💰 Created Finance User ${i}: finance${i}@company.com`);
            totalCreated++;

            // 3. PMs (3 per FU)
            for (let j = 1; j <= 3; j++) {
                const pmIndex = (i - 1) * 3 + j;
                const pmId = uuidv4();
                await User.create({
                    id: pmId,
                    name: `PM ${pmIndex}`,
                    email: `pm${pmIndex}@company.com`,
                    passwordHash,
                    role: ROLES.PROJECT_MANAGER,
                    managedBy: fuId
                });
                console.log(`📋 Created PM ${pmIndex} (under FU ${i}): pm${pmIndex}@company.com`);
                totalCreated++;

                // 4. Vendors (4 per PM)
                for (let k = 1; k <= 4; k++) {
                    const vendorIndex = (pmIndex - 1) * 4 + k;
                    await User.create({
                        id: uuidv4(),
                        name: `Vendor ${vendorIndex}`,
                        email: `vendor${vendorIndex}@company.com`,
                        passwordHash,
                        role: ROLES.VENDOR,
                        managedBy: pmId
                    });
                    totalCreated++;
                }
                console.log(`🏪 Created 4 Vendors for PM ${pmIndex}`);
            }
        }

        const finalCount = await User.countDocuments({});
        console.log(`\n✨ SEEDING COMPLETE!`);
        console.log(` - Users Created in loop: ${totalCreated}`);
        console.log(` - Current Users in DB: ${finalCount}`);
        
        if (finalCount === 33) {
            console.log('✅ Success: Exactly 33 users present.');
        } else {
            console.log('❌ Error: Expected 33 users but found', finalCount);
        }

        process.exit(0);
    } catch (e) {
        console.error('❌ SEEDING FAILED:', e.message);
        process.exit(1);
    }
}

seed();
