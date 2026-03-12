/**
 * Build Sample Hierarchy
 * Run with: node scripts/build-hierarchy.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema({
    id: String,
    managedBy: String
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function build() {
    try {
        await mongoose.connect(MONGODB_URI);
        
        // IDs from logs
        const adminId = "1f22480f-723c-480a-be99-bf7338972b98";
        const fu2Id = "44c6b0e4-e3ee-4f2d-8263-2c6496553f2c";
        const pmSalesId = "25956641-0d44-403e-84d5-1eef8795d220";
        const techNovaId = "064909d7-d7ae-4441-9f0c-7577f23401a2";

        // Admin -> FU2
        await User.findOneAndUpdate({ id: fu2Id }, { managedBy: adminId });
        console.log('✅ Assigned Finance User 2 to Admin');

        // FU2 -> PM Sales
        await User.findOneAndUpdate({ id: pmSalesId }, { managedBy: fu2Id });
        console.log('✅ Assigned PM-Sales to Finance User 2');

        // PM Sales -> TechNova
        await User.findOneAndUpdate({ id: techNovaId }, { managedBy: pmSalesId });
        console.log('✅ Assigned TechNova Solutions to PM-Sales');

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

build();
