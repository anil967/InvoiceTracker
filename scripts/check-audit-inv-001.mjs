
import mongoose from 'mongoose';

async function checkAudit() {
    try {
        await mongoose.connect('mongodb+srv://invoice:invoice1234@test.a0dvdj9.mongodb.net/invoice_tracker_db?retryWrites=true&w=majority&appName=test');
        console.log('Connected to DB');

        const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', new mongoose.Schema({
            id: String,
            status: String,
            financeApproval: mongoose.Schema.Types.Mixed,
            auditTrail: [mongoose.Schema.Types.Mixed]
        }));

        const inv = await Invoice.findOne({ invoiceNumber: 'INV-001' });
        if (!inv) {
            console.log('Invoice not found');
            return;
        }

        console.log('--- INV-001 DATA ---');
        console.log('ID:', inv.id);
        console.log('Invoice Number:', inv.invoiceNumber);
        console.log('Top-level Status:', inv.status);
        console.log('PM Approval Object:', JSON.stringify(inv.pmApproval, null, 2));
        console.log('Finance Approval Object:', JSON.stringify(inv.financeApproval, null, 2));
        console.log('--------------------');

    } catch (err) {
        console.error('Audit check failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

checkAudit();
