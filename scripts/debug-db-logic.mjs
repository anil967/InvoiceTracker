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

        const targetId = 'v-nexbridge';
        console.log(`--- Debugging DB Logic for: ${targetId} ---`);

        // 1. Check User
        const user = await db.collection('users').findOne({ id: targetId });
        if (!user) {
            console.log("User not found!");
            return;
        }
        console.log(`User Role: "${user.role}"`);

        // 2. Simulate db.getInvoices logic
        const query = {};
        // Simulate getNormalizedRole
        const role = user.role.toLowerCase() === 'vendor' ? 'Vendor' : user.role;
        console.log(`Normalized Role: "${role}"`);

        if (role === 'Vendor') {
             query.submittedByUserId = user.id;
             console.log(`Query: { submittedByUserId: "${user.id}" }`);
        } else {
            console.log("Role is not Vendor, logic differs.");
        }

        // 3. Run Query
        const invoices = await db.collection('invoices').find(query).toArray();
        console.log(`Found ${invoices.length} invoices matching query.`);
        
        if (invoices.length === 0) {
             console.log("  No invoices found. Checking ALL invoices for any match...");
             const allInvoices = await db.collection('invoices').find({}).toArray();
             console.log(`  Total invoices in DB: ${allInvoices.length}`);
             
             // Check if any invoice has this user ID in ANY field
             const submittedMatches = allInvoices.filter(i => i.submittedByUserId === user.id);
             console.log(`  Invoices with submittedByUserId === "${user.id}": ${submittedMatches.length}`);
             
             if (submittedMatches.length === 0) {
                 // Check partial matches or dirty data
                 const partial = allInvoices.filter(i => i.submittedByUserId && i.submittedByUserId.includes('nexbridge'));
                 console.log(`  Invoices with partial match 'nexbridge': ${partial.length}`);
                 
                 // Show a sample invoice to see what submittedByUserId looks like
                 if (allInvoices.length > 0) {
                     console.log(`  Sample Invoice submittedByUserId: "${allInvoices[0].submittedByUserId}" (Type: ${typeof allInvoices[0].submittedByUserId})`);
                 }
             }
        }

    } catch (e) {
        console.error("Script error:", e);
    } finally {
        await client.close();
    }
}

run();
