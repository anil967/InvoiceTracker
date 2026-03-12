import { MongoClient } from 'mongodb';
import 'dotenv/config'; 

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("Error: MONGODB_URI is not defined in .env or .env.local");
    process.exit(1);
}

const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db('invoice_tracker_db'); 

        console.log('--- ALL USERS ---');
        const users = await db.collection('users').find({}).toArray();
        users.forEach(u => {
            console.log(`- [${u.role}] ${u.name} (ID: ${u.id})`);
        });
        
        console.log('\n--- ALL VENDORS (Collection) ---');
        const vendors = await db.collection('vendors').find({}).toArray();
        vendors.forEach(v => {
            console.log(`- ${v.name} (ID: ${v.id}, LinkedUser: ${v.linkedUserId})`);
        });

    } catch (e) {
        console.error("Script error:", e);
    } finally {
        await client.close();
    }
}

run();
