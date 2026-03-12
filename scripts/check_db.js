
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://invoice:invoice1234@test.a0dvdj9.mongodb.net/invoice_tracker_db?retryWrites=true&w=majority&appName=test';

const UserSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: String,
    role: String,
    managedBy: String
});

const InvoiceSchema = new mongoose.Schema({
    id: String,
    invoiceNumber: String,
    status: String,
    assignedPM: String,
    assignedDeptHead: String,
    assignedDivHead: String,
    pmApproval: Object,
    receivedAt: Date
});

async function check() {
    try {
        await mongoose.connect(MONGODB_URI);
        const User = mongoose.model('User', UserSchema);
        const Invoice = mongoose.model('Invoice', InvoiceSchema);

        const users = await User.find({});
        const pmOps = users.find(u => u.email === 'pm.operations@company.com');

        console.log('--- DATA_START ---');
        console.log(JSON.stringify({
            users: users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, managedBy: u.managedBy })),
            invoices: (pmOps ? await Invoice.find({ assignedPM: pmOps.id }).sort({ receivedAt: -1 }).limit(10) : []).map(inv => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                status: inv.status,
                assignedDeptHead: inv.assignedDeptHead,
                pmApprovalStatus: inv.pmApproval?.status
            }))
        }, null, 2));
        console.log('--- DATA_END ---');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
