/**
 * Database Cleanup Script
 * Wipes all data from all collections.
 * Run with: node scripts/clean-db.mjs
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in .env');
    process.exit(1);
}

async function clean() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`🧹 Found ${collections.length} collections. Cleaning...`);

        for (const collection of collections) {
            const name = collection.name;
            // Skip system collections if any
            if (name.startsWith('system.')) continue;
            
            console.log(`   - Clearing collection: ${name}`);
            await mongoose.connection.db.collection(name).deleteMany({});
        }

        console.log('\n✨ Database cleaned successfully.');
        process.exit(0);

    } catch (e) {
        console.error('❌ Cleanup Failed:', e);
        process.exit(1);
    }
}

clean();
