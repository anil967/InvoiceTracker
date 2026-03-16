import { MongoClient } from 'mongodb';
import 'dotenv/config'; 

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("Error: MONGODB_URI is not defined in .env");
    process.exit(1);
}

const client = new MongoClient(uri);

async function listCollections() {
    try {
        await client.connect();
        const db = client.db('invoice_tracker_db'); 
        const collections = await db.listCollections().toArray();
        console.log('Collections:');
        collections.forEach(c => console.log(` - ${c.name}`));
    } catch (e) {
        console.error("Script error:", e);
    } finally {
        await client.close();
    }
}

listCollections();
