/**
 * Test DB Health Check Script
 * Verifies the connection logic used in lib/db.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

async function testHealth() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        console.log('🏥 Testing Health Check Logic (User.findOne)...');
        
        // This mirrors the logic added to lib/db.js
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Connection state is not open');
        }

        // Define a minimal User schema/model just for this test to avoid loading the full app model tree
        // We use the existing collection name 'users' (mongoose default for 'User')
        const UserSchema = new mongoose.Schema({ any: {} }, { strict: false });
        const User = mongoose.models.User || mongoose.model('User', UserSchema);

        const result = await User.findOne().select('_id').lean();
        
        console.log('✅ Health Check Passed!');
        console.log('   Read operation result:', result ? 'Found Document' : 'No Document Found (but query succeeded)');

        process.exit(0);
    } catch (e) {
        console.error('❌ Health Check Failed:', e);
        process.exit(1);
    }
}

testHealth();
