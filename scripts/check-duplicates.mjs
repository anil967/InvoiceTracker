import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';

const MONGODB_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function check() {
    try {
        await mongoose.connect(MONGODB_URI);
        const email = 'finance.user1@company.com';

        const results = {
            target: email,
            exactMatches: [],
            looseMatches: []
        };

        const users = await User.find({ email: new RegExp(`^${email}$`, 'i') }).lean();
        results.exactMatches = users.map(u => ({
            _id: u._id,
            id: u.id,
            email: u.email,
            passwordHash: u.passwordHash,
            passwordHashLength: u.passwordHash?.length,
            role: u.role
        }));

        const looseMatches = await User.find({ email: new RegExp(email, 'i') }).lean();
        results.looseMatches = looseMatches.map(u => ({
            _id: u._id,
            id: u.id,
            email: u.email,
            passwordHash: u.passwordHash,
            role: u.role
        }));

        fs.writeFileSync('duplicates_output.json', JSON.stringify(results, null, 2), 'utf8');
        console.log('✅ Results saved to duplicates_output.json');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
