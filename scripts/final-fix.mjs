/**
 * Final Role Fix & Verify
 * Run with: node scripts/final-fix.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';

const MONGODB_URI = process.env.MONGODB_URI;

const ROLES = {
    ADMIN: 'Admin',
    PROJECT_MANAGER: 'PM',
    FINANCE_USER: 'Finance User',
    VENDOR: 'Vendor'
};

const UserSchema = new mongoose.Schema({
    role: String,
    email: String,
    name: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        const users = await User.find({});
        const results = [];

        for (const u of users) {
            const oldRole = u.role;
            let newRole = oldRole;

            // Strict mapping based on email patterns if possible, or fuzzy role matching
            const email = u.email.toLowerCase();
            if (email.includes('admin@')) newRole = ROLES.ADMIN;
            else if (email.startsWith('pm.')) newRole = ROLES.PROJECT_MANAGER;
            else if (email.startsWith('finance.user')) newRole = ROLES.FINANCE_USER;
            else if (email.startsWith('vendor@')) newRole = ROLES.VENDOR;
            else {
                // Fallback to fuzzy role match
                const lower = oldRole.toLowerCase();
                if (lower.includes('admin')) newRole = ROLES.ADMIN;
                else if (lower.includes('pm') || lower.includes('project')) newRole = ROLES.PROJECT_MANAGER;
                else if (lower.includes('finance')) newRole = ROLES.FINANCE_USER;
                else if (lower.includes('vendor')) newRole = ROLES.VENDOR;
            }

            if (oldRole !== newRole) {
                u.role = newRole;
                await u.save();
            }
            results.push({ email: u.email, name: u.name, oldRole, newRole });
        }

        const output = JSON.stringify(results, null, 2);
        fs.writeFileSync('user-fix-log.json', output);
        console.log('✅ Fix complete. Check user-fix-log.json');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
