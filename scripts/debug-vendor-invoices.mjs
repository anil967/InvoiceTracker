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

        console.log('--- Debugging Vendors and Invoices ---');

        // 1. Check "vendors" collection first (since it exists)
        const vendorDocs = await db.collection('vendors').find({}).limit(5).toArray();
        console.log(`Found ${vendorDocs.length} docs in 'vendors' collection:`);
        vendorDocs.forEach(v => console.log(`- Vendor: ${v.name} | ID: ${v.id} | LinkedUser: ${v.linkedUserId}`));

        // 2. Check "users" collection for VENDOR role (handle case sensitivity)
        // Using regex to match 'vendor', 'VENDOR', 'Vendor'
        const vendorUsers = await db.collection('users').find({ role: { $regex: /^vendor$/i } }).limit(5).toArray();
        console.log(`\nFound ${vendorUsers.length} users with role 'vendor' (case-insensitive):`);
        vendorUsers.forEach(u => console.log(`- User: ${u.name} | ID: ${u.id} | Role: ${u.role} | VendorID: ${u.vendorId}`));

        // 3. Pick a vendor ID to check invoices
        let targetUserId = null;
        if (vendorUsers.length > 0) {
            targetUserId = vendorUsers[0].id;
            console.log(`\nUsing User ID from 'users' collection: ${targetUserId}`);
        } else if (vendorDocs.length > 0 && vendorDocs[0].linkedUserId) {
            targetUserId = vendorDocs[0].linkedUserId;
             console.log(`\nUsing Linked User ID from 'vendors' collection: ${targetUserId}`);
        }

        if (targetUserId) {
            // Check for invoices submitted by this user
            const invoices = await db.collection('invoices').find({ submittedByUserId: targetUserId }).toArray();
            console.log(`\nFound ${invoices.length} invoices for submittedByUserId="${targetUserId}"`);
            
            if (invoices.length > 0) {
                invoices.forEach(inv => console.log(`- Invoice: ${inv.invoiceNumber} | Status: ${inv.status} | Amount: ${inv.amount}`));
            } else {
                 console.log("No invoices found for this user.");
                 // Check if maybe invoices are linked by vendorId instead?
                 if (vendorUsers.length > 0 && vendorUsers[0].vendorId) {
                     const vid = vendorUsers[0].vendorId;
                     console.log(`Checking by vendorId="${vid}"...`);
                     const invByVid = await db.collection('invoices').find({ vendorId: vid }).toArray();
                     console.log(`Found ${invByVid.length} invoices by vendorId.`);
                 }
            }
        } else {
            console.log("\nCould not identify a target vendor user ID to check invoices.");
        }

    } catch (e) {
        console.error("Script error:", e);
    } finally {
        await client.close();
    }
}

run();
