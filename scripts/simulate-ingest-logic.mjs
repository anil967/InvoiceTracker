import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
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
        const invoices = db.collection('invoices');

        const user = {
            id: 'v-nexbridge',
            name: 'NexBridge Partners',
            role: 'Vendor',
             vendorId: 'v-nexbridge' // This might be null in DB, but let's assume session has it or not
        };

        console.log(`--- Simulating Ingestion for ${user.id} ---`);

        const invoiceId = `INV-SIM-${uuidv4().slice(0, 8).toUpperCase()}`;
        console.log(`Generated Invoice ID: ${invoiceId}`);

        const invoiceMetadata = {
            id: invoiceId,
            vendorName: user.name,
            submittedByUserId: user.id, 
            originalName: "test-invoice.pdf",
            status: "SUBMITTED",
            receivedAt: new Date().toISOString(),
            amount: 1234.56,
            created_at: new Date()
        };

        console.log("Saving invoice with metadata:", JSON.stringify(invoiceMetadata, null, 2));

        // Simulate db.saveInvoice (upsert)
        await invoices.updateOne(
            { id: invoiceId },
            { $set: invoiceMetadata },
            { upsert: true }
        );

        console.log("Invoice saved.");

        // Now Try to Find it using the logic from getVendorDashboardData -> db.getInvoices
        console.log("Querying for dashboard...");
        
        const query = { submittedByUserId: user.id };
        const found = await invoices.find(query).toArray();
        
        console.log(`Found ${found.length} invoices for user ${user.id}`);
        const ours = found.find(i => i.id === invoiceId);
        
        if (ours) {
            console.log("✅ Success! The simulated invoice was found.");
            console.log(`   - ID: ${ours.id}`);
            console.log(`   - SubmittedBy: ${ours.submittedByUserId}`);
        } else {
            console.log("❌ Failure! The invoice was NOT found in the query results.");
        }

    } catch (e) {
        console.error("Script error:", e);
    } finally {
        await client.close();
    }
}

run();
