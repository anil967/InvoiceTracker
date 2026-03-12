
import mongoose from 'mongoose';

async function listInvoices() {
    try {
        await mongoose.connect('mongodb+srv://invoice:invoice1234@test.a0dvdj9.mongodb.net/invoice_tracker_db?retryWrites=true&w=majority&appName=test');
        console.log('Connected to DB');

        const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', new mongoose.Schema({}, { strict: false }));

        const invoices = await Invoice.find({ status: 'MATCH_DISCREPANCY' }).sort({ created_at: -1 }).limit(1);
        console.log(`Found ${invoices.length} invoices`);

        if (invoices.length > 0) {
            console.log(JSON.stringify(invoices[0], null, 2));
        }

    } catch (err) {
        console.error('List failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

listInvoices();
