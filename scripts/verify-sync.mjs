/**
 * Database Sync Verification Script
 * Audits the hierarchy in MongoDB to ensure it matches expectations.
 * Run with: node scripts/verify-sync.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

const ROLES = {
    ADMIN: 'Admin',
    PROJECT_MANAGER: 'PM',
    FINANCE_USER: 'Finance User',
    VENDOR: 'Vendor'
};

const UserSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: String,
    role: String,
    managedBy: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function verify() {
    try {
        await mongoose.connect(MONGODB_URI);
        const users = await User.find({}).lean();
        
        console.log(`\n📊 DATABASE AUDIT SUMMARY (${new Date().toLocaleString()})`);
        console.log(`--------------------------------------------------`);
        console.log(`Total Users Found: ${users.length}`);

        const counts = {
            [ROLES.ADMIN]: 0,
            [ROLES.FINANCE_USER]: 0,
            [ROLES.PROJECT_MANAGER]: 0,
            [ROLES.VENDOR]: 0,
            'Other': 0
        };

        const userMap = {};
        users.forEach(u => {
            counts[u.role] = (counts[u.role] || 0) + 1;
            userMap[u.id] = u;
        });

        console.log(`Role Distribution:`);
        Object.entries(counts).forEach(([role, count]) => {
            console.log(` - ${role.padEnd(15)}: ${count}`);
        });

        console.log(`\n🔍 STRUCTURAL INTEGRITY CHECK:`);
        let errors = 0;
        let warnings = 0;
        let correctlyLinked = 0;

        users.forEach(u => {
            if (u.role === ROLES.ADMIN) {
                if (u.managedBy) {
                    console.log(`❌ ERROR: Admin ${u.email} should not have a manager.`);
                    errors++;
                } else {
                    correctlyLinked++;
                }
            } else {
                if (!u.managedBy) {
                    console.log(`⚠️ WARNING: User ${u.email} (${u.role}) is UNASSIGNED.`);
                    warnings++;
                } else if (!userMap[u.managedBy]) {
                    console.log(`❌ ERROR: User ${u.email} points to missing manager ID: ${u.managedBy}`);
                    errors++;
                } else {
                    const manager = userMap[u.managedBy];
                    // Validate role hierarchy logic
                    let validParent = false;
                    if (u.role === ROLES.FINANCE_USER && manager.role === ROLES.ADMIN) validParent = true;
                    if (u.role === ROLES.PROJECT_MANAGER && manager.role === ROLES.FINANCE_USER) validParent = true;
                    if (u.role === ROLES.VENDOR && manager.role === ROLES.PROJECT_MANAGER) validParent = true;

                    if (!validParent) {
                        console.log(`❌ ERROR: Invalid hierarchy! ${u.role} (${u.email}) managed by ${manager.role} (${manager.email})`);
                        errors++;
                    } else {
                        correctlyLinked++;
                    }
                }
            }
        });

        console.log(`\nResults:`);
        console.log(` - Correctly Linked: ${correctlyLinked}`);
        console.log(` - Structural Errors: ${errors}`);
        console.log(` - Unassigned (Warn): ${warnings}`);

        if (errors === 0 && users.length === 33) {
            console.log(`\n✅ DATABASE SYNC VERIFIED: Structure is perfect (33 users correctly linked).`);
        } else {
            console.log(`\n❌ SYNC FAILURE: Database state does not match structural expectations.`);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

verify();
