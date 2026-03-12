/**
 * Role Normalization Script
 * Updates all users in the database to use canonical role strings.
 * Run with: node scripts/fix-roles.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

const ROLES = {
    ADMIN: 'Admin',
    PROJECT_MANAGER: 'PM',
    FINANCE_USER: 'Finance User',
    VENDOR: 'Vendor'
};

const UserSchema = new mongoose.Schema({
    role: String,
    email: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function fixRoles() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        const users = await User.find({});
        console.log(`🔍 Checking ${users.length} users...`);

        for (const user of users) {
             const oldRole = user.role;
             let newRole = oldRole;

             const lower = oldRole.toLowerCase();
             if (['admin'].includes(lower)) newRole = ROLES.ADMIN;
             else if (['pm', 'projectmanager', 'project manager'].includes(lower)) newRole = ROLES.PROJECT_MANAGER;
             else if (['financeuser', 'finance user', 'finance_user'].includes(lower)) newRole = ROLES.FINANCE_USER;
             else if (['vendor'].includes(lower)) newRole = ROLES.VENDOR;

             if (oldRole !== newRole) {
                 user.role = newRole;
                 await user.save();
                 console.log(`✅ Updated ${user.email}: ${oldRole} -> ${newRole}`);
             }
        }

        console.log('\n✨ Role normalization complete.');
        process.exit(0);

    } catch (e) {
        console.error('❌ Fix Failed:', e);
        process.exit(1);
    }
}

fixRoles();
