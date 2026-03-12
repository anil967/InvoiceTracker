import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const MONGODB_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema({
    email: { type: String, lowercase: true },
    passwordHash: String
}, { strict: false });
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const EXPECTED_CREDENTIALS = [
    { email: 'admin@company.com', password: 'Admin@Secure2025' },
    { email: 'finance.user1@company.com', password: 'Finance@U12025' },
    { email: 'finance.user2@company.com', password: 'Finance@U22025' },
    { email: 'pm.sales@company.com', password: 'PM@Sales2025' },
    { email: 'pm.marketing@company.com', password: 'PM@Mktg2025' },
    { email: 'pm.operations@company.com', password: 'PM@Ops2025' },
    { email: 'vendor@technovasolutions.com', password: 'Vendor@TN2025' },
    { email: 'vendor@blupeakent.com', password: 'Vendor@BP2025' },
    { email: 'vendor@meridianglobal.com', password: 'Vendor@MG2025' },
    { email: 'vendor@apexdigitalworks.com', password: 'Vendor@AD2025' },
    { email: 'vendor@stellarsupplies.com', password: 'Vendor@SS2025' },
    { email: 'vendor@crestlineind.com', password: 'Vendor@CI2025' },
    { email: 'vendor@horizontradegroup.com', password: 'Vendor@HT2025' },
    { email: 'vendor@nexbridgepartners.com', password: 'Vendor@NB2025' }
];

async function verifyAll() {
    try {
        await mongoose.connect(MONGODB_URI);
        const results = [];

        for (const cred of EXPECTED_CREDENTIALS) {
            const user = await User.findOne({ email: cred.email }).lean();
            if (!user) {
                results.push({ email: cred.email, status: 'NOT_FOUND' });
                continue;
            }

            const isValid = await bcrypt.compare(cred.password, user.passwordHash);
            results.push({
                email: cred.email,
                status: isValid ? 'OK' : 'MISMATCH',
                hash: user.passwordHash
            });
        }

        fs.writeFileSync('all_credentials_verification.json', JSON.stringify(results, null, 2), 'utf8');
        console.log('✅ Verification report saved.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

verifyAll();
