import 'dotenv/config';
import mongoose from 'mongoose';
import fs from 'fs';

const MONGODB_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema({
    email: { type: String, lowercase: true },
    passwordHash: String,
    role: String,
    name: String
}, { strict: false });
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function checkAll() {
    try {
        await mongoose.connect(MONGODB_URI);
        const users = await User.find({}).lean();

        console.log(`Total users found: ${users.length}`);

        const results = users.map(u => ({
            email: u.email,
            role: u.role,
            hashLength: u.passwordHash?.length || 0,
            isTruncated: (u.passwordHash?.length || 0) < 60 && (u.passwordHash?.length || 0) > 0,
            hashPrefix: u.passwordHash ? u.passwordHash.substring(0, 10) + '...' : 'N/A'
        }));

        fs.writeFileSync('hashes_report.json', JSON.stringify(results, null, 2), 'utf8');
        console.log('✅ Results saved to hashes_report.json');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkAll();
