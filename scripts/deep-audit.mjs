/**
 * Deep Mongo Audit
 * Checks for all databases and collections to find where the ghosts are.
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI;

async function audit() {
    const client = new MongoClient(URI);
    try {
        await client.connect();
        console.log('Connected to cluster.');

        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        
        console.log('\n--- Databases ---');
        for (const dbInfo of dbs.databases) {
            console.log(`DB: ${dbInfo.name}`);
            const db = client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();
            for (const coll of collections) {
                const count = await db.collection(coll.name).countDocuments();
                console.log(`  - Coll: ${coll.name} (${count} docs)`);
                if (coll.name === 'users') {
                    const samples = await db.collection(coll.name).find({ email: /vendor48/ }).toArray();
                    if (samples.length > 0) {
                        console.log(`    !!! FOUND VENDOR 48 HERE !!!`);
                    }
                }
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

audit();
