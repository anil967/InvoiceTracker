import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

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
        await mongoose.connect(MONGODB_URI);
        const email = 'finance.user2@company.com';
        const password = 'Finance@U22025';

        console.log(`Checking user: ${email}...`);
        const user = await User.findOne({ email: email.toLowerCase() }).lean();

        if (!user) {
            console.log('❌ User not found in database.');
        } else {
            console.log(`✅ User found: ${user.name} (Role: ${user.role})`);
            console.log('User Document Keys:', Object.keys(user));
            console.log('passwordHash value:', user.passwordHash);
            console.log('password_hash value:', user.password_hash);

            const isValid = await bcrypt.compare(password, user.passwordHash);
            if (isValid) {
                console.log('✅ Password matches hash in DB!');
            } else {
                console.log('❌ Password does NOT match hash in DB.');
            }
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

verify();
