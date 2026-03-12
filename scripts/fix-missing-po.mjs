
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

async function fixPO() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected');

        const pos = [
            {
                id: 'po-001',
                poNumber: 'PO-2026-001',
                vendorId: 'v-001',
                date: '2026-02-01',
                totalAmount: 50000.00,
                currency: 'INR',
                status: 'OPEN',
                items: [
                    { description: 'Cloud infrastructure - Feb', quantity: 1, unitPrice: 45000.00, amount: 45000.00, glAccount: 'GL-5000' },
                    { description: 'Setup Fee', quantity: 1, unitPrice: 5000.00, amount: 5000.00, glAccount: 'GL-5001' }
                ]
            },
            {
                id: 'po-002',
                poNumber: 'PO-2026-002',
                vendorId: 'v-002',
                date: '2026-01-15',
                totalAmount: 125000.00,
                currency: 'INR',
                status: 'OPEN',
                items: [
                    { description: 'Software Development Services', quantity: 100, unitPrice: 1250.00, amount: 125000.00, glAccount: 'GL-6000' }
                ]
            }
        ];

        for (const po of pos) {
            const existing = await PurchaseOrder.findOne({ poNumber: po.poNumber });
            if (existing) {
                console.log(`PO ${po.poNumber} already exists. Updating...`);
                Object.assign(existing, po);
                await existing.save();
                console.log(`✅ Updated PO ${po.poNumber}`);
            } else {
                await PurchaseOrder.create(po);
                console.log(`✅ Created PO ${po.poNumber}`);
            }
        }

        console.log('✨ Fix completed!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

fixPO();
