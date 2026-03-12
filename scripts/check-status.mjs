import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function checkCollections() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections Status:');
        for (const col of collections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            const sample = await mongoose.connection.db.collection(col.name).findOne({});
            console.log(`\n- ${col.name}: ${count} documents`);
            if (sample) {
                console.log(`  Sample (fields): ${Object.keys(sample).join(', ')}`);
                if (!sample.id && sample._id) {
                    console.log(`  ⚠️  Warning: 'id' field is missing, only '_id' found.`);
                }
            }
        }
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkCollections();
