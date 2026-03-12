
import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local or .env');
}

const PurchaseOrderSchema = new mongoose.Schema({
    id: String,
    poNumber: String,
    vendorId: String,
    date: String,
    totalAmount: Number,
    currency: String,
    status: String,
    items: Array
});

const PurchaseOrder = mongoose.models.PurchaseOrder || mongoose.model('PurchaseOrder', PurchaseOrderSchema);

async function checkPO() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        const poNumber = 'PO-2026-001';
        const po = await PurchaseOrder.findOne({ poNumber });

        if (po) {
            console.log(`✅ PO ${poNumber} found in DB.`);
            console.log(JSON.stringify(po, null, 2));
        } else {
            console.log(`❌ PO ${poNumber} NOT found in DB.`);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkPO();
