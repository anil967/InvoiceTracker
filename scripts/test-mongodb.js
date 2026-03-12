
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load .env
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in .env');
    process.exit(1);
}

async function testConnection() {
    console.log('Testing connection to MongoDB...');
    console.log('URI:', MONGODB_URI.replace(/:([^@]+)@/, ':****@')); // Hide password

    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        });
        console.log('Successfully connected to MongoDB!');
        
        const admin = mongoose.connection.db.admin();
        const info = await admin.ping();
        console.log('Ping result:', info);

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        await mongoose.disconnect();
        console.log('Disconnected.');
    } catch (error) {
        console.error('Connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();
