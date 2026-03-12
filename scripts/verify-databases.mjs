/**
 * Verification Script: List all databases to confirm cleanup
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

async function verify() {
    console.log('\n📋 Listing all databases in the cluster...\n');

    try {
        const rawUri = process.env.MONGODB_URI || '';
        const [uriWithoutParams, queryParams] = rawUri.split('?');
        const MONGODB_URI_BASE = uriWithoutParams.replace(/\/[^/.]+$/, '');
        const qs = queryParams ? `?${queryParams}` : '';

        // Connect to the cluster
        await mongoose.connect(`${MONGODB_URI_BASE}/admin${qs}`);
        const conn = mongoose.connection;

        // List all databases
        const adminDb = conn.db.admin();
        const databases = await adminDb.listDatabases();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('DATABASES STATUS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const dbNames = databases.databases.map(db => db.name);
        
        // Filter system databases (local, admin, config)
        const systemDBs = ['local', 'admin', 'config'];
        const userDBs = dbNames.filter(name => !systemDBs.includes(name));
        
        console.log('\n🔧 System Databases:');
        systemDBs.forEach(db => {
            const found = databases.databases.find(d => d.name === db);
            console.log(`  - ${db}`);
        });
        
        console.log('\n📊 User Databases:');
        if (userDBs.length === 0) {
            console.log('  (none)');
        } else {
            userDBs.forEach(db => {
                const found = databases.databases.find(d => d.name === db);
                const sizeOnDisk = found ? (found.sizeOnDisk / 1024 / 1024).toFixed(2) + ' MB' : 'N/A';
                console.log(`  - ${db} (size: ${sizeOnDisk})`);
            });
        }
        
        // Verify expected databases exist
        const expectedDBs = ['users', 'admin_db', 'internal_data'];
        const missingDBs = expectedDBs.filter(db => !userDBs.includes(db));
        const unexpectedDBs = userDBs.filter(db => !expectedDBs.includes(db));
        
        console.log('\n✅ Verification Summary:');
        console.log(`  - Expected databases present: ${expectedDBs.filter(db => userDBs.includes(db)).join(', ')}`);
        
        if (missingDBs.length > 0) {
            console.log(`  ⚠️  Missing expected databases: ${missingDBs.join(', ')}`);
        }
        
        if (unexpectedDBs.length > 0) {
            console.log(`  ⚠️  Unexpected databases found: ${unexpectedDBs.join(', ')}`);
        }
        
        if (missingDBs.length === 0 && unexpectedDBs.length === 0) {
            console.log('\n✅ Database cleanup verification PASSED!');
            console.log('   Only expected databases (users, admin_db, internal_data) remain.');
        } else {
            console.log('\n⚠️  Database cleanup verification has WARNINGS.');
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
    } catch (err) {
        console.error('\n💥 ERROR during verification:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

verify();