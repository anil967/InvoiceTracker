/**
 * ID Verification Script
 * Checks if all users have an 'id' field.
 * Run with: node scripts/verify-ids.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema({
    id: String,
    email: String,
    role: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function verify() {
    try {
        await mongoose.connect(MONGODB_URI);
        const users = await User.find({});
        console.log(`Checking ${users.length} users...`);
        let missing = 0;
        users.forEach(u => {
            if (!u.id) {
                console.log(`❌ Missing ID for: ${u.email}`);
                missing++;
            } else {
                console.log(`✅ ID present for: ${u.email} (${u.id})`);
            }
        });
        console.log(`\nMissing IDs: ${missing}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

verify();
