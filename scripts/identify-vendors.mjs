import { MongoClient } from 'mongodb';
import 'dotenv/config'; 

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("Error: MONGODB_URI is not defined in .env");
    process.exit(1);
}

const client = new MongoClient(uri);

async function findVendors() {
    try {
        await client.connect();
        const db = client.db('invoice_tracker_db'); 
        const users = db.collection('users');

        const emails = [
            'vendorr1@gmail.com',
            'testvendor_new@test.com',
            'biswajitdash929@gmail.com'
        ];

        console.log('--- Finding Vendors ---');
        for (const email of emails) {
            const user = await users.findOne({ email: email.toLowerCase() });
            if (user) {
                console.log(`Found: ${user.name} (${user.email}) - ID: ${user.id}`);
                
                // Check for invoices
                const invoiceCount = await db.collection('invoices').countDocuments({ submittedByUserId: user.id });
                console.log(`  Invoices: ${invoiceCount}`);
            } else {
                console.log(`Not found: ${email}`);
            }
        }

    } catch (e) {
        console.error("Script error:", e);
    } finally {
        await client.close();
    }
}

findVendors();
