import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        const db = mongoose.connection.db;

        await db.collection('admin_data').deleteMany({});
        console.log('Cleared admin_data');

        await db.collection('internal_data').deleteMany({});
        console.log('Cleared internal_data');

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

cleanup();
