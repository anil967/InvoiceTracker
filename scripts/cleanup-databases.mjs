/**
 * Cleanup Script: Decommission legacy and leftover databases
 * 
 * Databases to drop:
 * 1. invoice_tracker_db (Legacy backup)
 * 2. Internal (Leftover with 'data' collection)
 * 3. autoinvoice_test_verification (Leftover test DB)
 */

import mongoose from 'mongoose';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Get project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
config({ path: join(projectRoot, '.env') });

const DBS_TO_DROP = [
    'invoice_tracker_db',
    'Internal',
    'autoinvoice_test_verification'
];

async function cleanup() {
    console.log('\n🧹 Starting Cleanup of Legacy Databases');
    console.log('Targeting:', DBS_TO_DROP.join(', '), '\n');

    let conn;

    try {
        const rawUri = process.env.MONGODB_URI || '';
        const [uriWithoutParams, queryParams] = rawUri.split('?');
        const MONGODB_URI_BASE = uriWithoutParams.replace(/\/[^/.]+$/, '');
        const qs = queryParams ? `?${queryParams}` : '';

        // Connect to the cluster
        await mongoose.connect(`${MONGODB_URI_BASE}/admin${qs}`);
        conn = mongoose.connection;
        console.log('✅ Connected to MongoDB Cluster\n');

        for (const dbName of DBS_TO_DROP) {
            console.log(`📡 Dropping database: ${dbName}...`);
            const db = conn.useDb(dbName);

            try {
                await db.dropDatabase();
                console.log(`  ✅ Successfully dropped ${dbName}`);
            } catch (err) {
                console.warn(`  ⚠️  Warning dropping ${dbName}: ${err.message}`);
            }
        }

        console.log('\n✨ Cleanup completed successfully.');

    } catch (err) {
        console.error('\n💥 FATAL ERROR during cleanup:', err);
    } finally {
        if (conn) await mongoose.disconnect();
        process.exit(0);
    }
}

cleanup();
