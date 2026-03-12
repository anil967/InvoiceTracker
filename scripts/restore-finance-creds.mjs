import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

const UserSchema = new mongoose.Schema({
    email: { type: String, lowercase: true },
    passwordHash: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function restore() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.\n');

        const usersToRestore = [
            { email: 'finance.user1@company.com', password: 'Finance@U12025' },
            { email: 'finance.user2@company.com', password: 'Finance@U22025' }
        ];

        for (const u of usersToRestore) {
            console.log(`Restoring ${u.email}...`);
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(u.password, salt);

            const result = await User.updateOne(
                { email: u.email.toLowerCase() },
                { $set: { passwordHash: hash } }
            );

            if (result.matchedCount > 0) {
                console.log(`✅ Restored ${u.email}`);
            } else {
                console.log(`⚠️ User ${u.email} not found in database.`);
            }
        }

        console.log('\n✨ Restoration process completed.');
        process.exit(0);
    } catch (e) {
        console.error('❌ Restoration failed:', e);
        process.exit(1);
    }
}

restore();
