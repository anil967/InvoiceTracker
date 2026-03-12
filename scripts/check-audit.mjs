import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

const AuditTrailSchema = new mongoose.Schema({
    action: String,
    details: String,
    username: String,
    timestamp: Date
}, { strict: false });
const AuditTrail = mongoose.models.AuditTrail || mongoose.model('AuditTrail', AuditTrailSchema);

async function checkLogs() {
    try {
        await mongoose.connect(MONGODB_URI);
        const logs = await AuditTrail.find({
            $or: [
                { details: /login/i },
                { action: /login/i },
                { username: /finance/i }
            ]
        }).sort({ timestamp: -1 }).limit(20).lean();

        console.log('Recent Login-Related Audit Logs:');
        console.log(JSON.stringify(logs, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkLogs();
