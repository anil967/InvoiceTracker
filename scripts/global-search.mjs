/**
 * Global Search
 * Finds where Vendor 48 is hiding.
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI;

async function search() {
    const client = new MongoClient(URI);
    try {
        await client.connect();
        const admin = client.db().admin();
        const dbs = await admin.listDatabases();
        
        for (const dbInfo of dbs.databases) {
            const db = client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();
            for (const coll of collections) {
                const results = await db.collection(coll.name).find({ $or: [
                    { name: /Vendor 48/i },
                    { email: /vendor48/i }
                ]}).toArray();
                if (results.length > 0) {
                    console.log(`FOUND IN DB: ${dbInfo.name}, COLL: ${coll.name}`);
                    console.log(JSON.stringify(results, null, 2));
                }
            }
        }
    } finally {
        await client.close();
    }
}

search();
