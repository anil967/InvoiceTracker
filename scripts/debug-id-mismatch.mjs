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

        console.log('--- Analyzing User vs Invoice IDs ---');

        // 1. Distinct submittedByUserId from invoices
        const submitters = await db.collection('invoices').distinct('submittedByUserId');
        console.log(`\nDistinct submittedByUserId in Invoices:`);
        console.log(submitters);

        // 2. All User IDs
        const users = await db.collection('users').find({}).project({ id: 1, name: 1, role: 1 }).toArray();
        console.log(`\nAll Users in DB:`);
        users.forEach(u => console.log(`- ${u.id} (${u.name}, ${u.role})`));

        // 3. Check for mismatches
        console.log(`\nChecking for mismatches:`);
        submitters.forEach(sid => {
            const found = users.find(u => u.id === sid);
            if (found) {
                console.log(`✅ Invoice submitter "${sid}" matches User "${found.name}"`);
            } else {
                console.log(`❌ Invoice submitter "${sid}" DOES NOT match any user!`);
            }
        });

    } catch (e) {
        console.error("Script error:", e);
    } finally {
        await client.close();
    }
}

run();
