import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { db } from '../lib/db.js';

const UserSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: { type: String, lowercase: true },
    passwordHash: String,
    role: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function verify() {
    try {
        const email = 'finance.user1@company.com';
        const password = 'Finance@U12025';

        console.log(`[DEBUG] Attempting to find user with email: ${email}`);

        // Ensure connection
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const user = await db.getUserByEmail(email);

        if (!user) {
            console.log('❌ User not found via db.getUserByEmail');
            const allUsers = await User.find({ email: new RegExp(email, 'i') }).lean();
            console.log(`[DEBUG] Raw lookup found ${allUsers.length} matches:`, JSON.stringify(allUsers, null, 2));
        } else {
            console.log(`✅ User found: ${user.name} (Role: ${user.role})`);
            console.log(`[DEBUG] user.password_hash: ${user.password_hash}`);

            // Re-fetch raw document to see passwordHash directly
            const rawDoc = await User.findOne({ email: email.toLowerCase() }).lean();
            console.log(`[DEBUG] Raw passwordHash in DB: ${rawDoc.passwordHash}`);

            const isValid = await bcrypt.compare(password, user.password_hash);
            console.log(`[DEBUG] Testing password: "${password}"`);
            if (isValid) {
                console.log('✅ Password matches hash!');
            } else {
                console.log('❌ Password does NOT match hash.');
            }
        }
        process.exit(0);
    } catch (e) {
        console.error('Error during verification:', e);
        process.exit(1);
    }
}

verify();
