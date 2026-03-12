import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema({ email: String, passwordHash: String, role: String });
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function diagnostic() {
    try {
        await mongoose.connect(MONGODB_URI);
        const email = 'finance.user1@company.com';
        const targetPass = 'Finance@U12025';

        const user = await User.findOne({ email: email.toLowerCase() }).lean();
        if (!user) {
            console.log('User not found.');
            process.exit(1);
        }

        console.log(`User: ${user.email}`);
        console.log(`Stored Hash: ${user.passwordHash}`);

        const variations = [
            targetPass,
            targetPass.toLowerCase(),
            targetPass.toUpperCase(),
            targetPass.trim(),
            'Finance@u12025',
            'Finance@UI2025',
            'finance@u12025',
            'Finance@U1 2025',
            'Finance@U12025 '
        ];

        console.log('\nTesting variations:');
        for (const v of variations) {
            const match = await bcrypt.compare(v, user.passwordHash);
            console.log(`- "${v}": ${match ? 'MATCH ✅' : 'FAIL ❌'}`);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

diagnostic();
