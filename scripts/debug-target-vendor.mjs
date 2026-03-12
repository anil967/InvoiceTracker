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
        console.log(`--- Debugging User: ${targetId} ---`);

        const user = await db.collection('users').findOne({ id: targetId });
        if (user) {
            console.log('User Found:');
            console.log(JSON.stringify(user, null, 2));
            console.log(`Role Type: ${typeof user.role}`);
            console.log(`Role Value: "${user.role}"`);
            
            // Check invoices for this user
            const invoiceCount = await db.collection('invoices').countDocuments({ submittedByUserId: targetId });
            console.log(`Invoices submitted by ${targetId}: ${invoiceCount}`);

            if (invoiceCount === 0) {
                 // Check if invoices exist for ANY vendor
                 const anyVendorInv = await db.collection('invoices').findOne({ submittedByUserId: { $regex: /^v-/ } });
                 if (anyVendorInv) {
                     console.log(`Found an invoice for DIFFERENT vendor: ${anyVendorInv.submittedByUserId}`);
                 } else {
                     console.log("No invoices found for ANY vendor-like ID (starting with v-)");
                 }
            }
        } else {
            console.log("User not found in 'users' collection.");
        }

    } catch (e) {
        console.error("Script error:", e);
    } finally {
        await client.close();
    }
}

run();
