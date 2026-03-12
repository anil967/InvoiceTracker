import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Direct imports to test the user's model files
import { Vendor, Project } from '../models/Admin.js';
import { Otp, DocumentUpload } from '../models/Internal.js';
import Users from '../models/Users.js';

async function smokeTest() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Test Users
        const userCount = await Users.countDocuments({});
        console.log(`✅ Users collection: ${userCount} documents`);

        // Test Admin (Discriminators)
        const vendorCount = await Vendor.countDocuments({});
        console.log(`✅ Admin -> Vendor: ${vendorCount} documents`);

        const projectCount = await Project.countDocuments({});
        console.log(`✅ Admin -> Project: ${projectCount} documents`);

        // Test Internal (Discriminators)
        const otpCount = await Otp.countDocuments({});
        console.log(`✅ Internal -> Otp: ${otpCount} documents`);

        const uploadCount = await DocumentUpload.countDocuments({});
        console.log(`✅ Internal -> DocumentUpload: ${uploadCount} documents`);

        await mongoose.disconnect();
        console.log('✅ Smoke test completed successfully');
    } catch (error) {
        console.error('❌ Smoke test failed:', error.message);
        console.error(error.stack);
    }
}

smokeTest();
