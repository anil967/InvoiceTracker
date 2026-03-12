/**
 * Sync Test
 * Changes Admin name to verify DB connection.
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI;

async function test() {
    await mongoose.connect(URI);
    const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ id: String, name: String }));
    
    const admin = await User.findOne({ role: 'Admin' }) || await User.findOne({ email: 'admin@company.com' });
    if (admin) {
        const oldName = admin.name;
        const newName = `System Admin [SYNCED ${new Date().toLocaleTimeString()}]`;
        admin.name = newName;
        await admin.save();
        console.log(`Updated Admin Name from "${oldName}" to "${newName}"`);
    } else {
        console.log('Admin not found in this DB.');
    }
    process.exit(0);
}

test();
