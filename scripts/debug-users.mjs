/**
 * User Debug Script
 * Lists all users and their current roles.
 * Run with: node scripts/debug-users.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

const UserSchema = new mongoose.Schema({
    role: String,
    email: String,
    name: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function debug() {
    try {
        await mongoose.connect(MONGODB_URI);
        const users = await User.find({});
        console.log('--- Current Users in DB ---');
        users.forEach(u => {
            console.log(`Email: ${u.email} | Name: ${u.name} | Role: [${u.role}]`);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debug();
