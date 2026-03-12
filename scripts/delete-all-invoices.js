const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://invoice:invoice1234@test.a0dvdj9.mongodb.net/invoice_tracker_db?retryWrites=true&w=majority&appName=test';

const InvoiceSchema = new mongoose.Schema({
    id: String,
    invoiceNumber: String,
    status: String,
    vendorName: String,
    receivedAt: Date
});

async function deleteAllInvoices() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully.\n');

        const Invoice = mongoose.model('Invoice', InvoiceSchema);

        // Count invoices before deletion
        const countBefore = await Invoice.countDocuments();
        console.log(`Total invoices before deletion: ${countBefore}\n`);

        if (countBefore === 0) {
            console.log('No invoices to delete.');
        } else {
            // Delete all invoices
            console.log('Deleting all invoices...');
            const result = await Invoice.deleteMany({});
            console.log(`Deleted ${result.deletedCount} invoices.\n`);
        }

        // Verify deletion
        const countAfter = await Invoice.countDocuments();
        console.log(`Total invoices after deletion: ${countAfter}\n`);

        if (countAfter === 0) {
            console.log('✅ All invoices deleted successfully!');
        } else {
            console.log('⚠️  Some invoices remain. Please check.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

deleteAllInvoices();