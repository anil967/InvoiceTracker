import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const col = mongoose.connection.db.collection('users');
        const indexes = await col.listIndexes().toArray();
        console.log('Indexes on users:');
        console.log(JSON.stringify(indexes, null, 2));
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkIndexes();
