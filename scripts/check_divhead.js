const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb+srv://invoice:invoice1234@test.a0dvdj9.mongodb.net/invoice_tracker_db?retryWrites=true&w=majority&appName=test';

const InvoiceSchema = new mongoose.Schema({
    id: String, invoiceNumber: String, status: String,
    assignedPM: String, assignedDeptHead: String, assignedDivHead: String,
    pmApproval: Object, deptHeadApproval: Object, divHeadApproval: Object
});

async function check() {
    await mongoose.connect(MONGODB_URI);
    const Invoice = mongoose.model('Invoice', InvoiceSchema);

    // Simulate exactly what db.getInvoices would do for Div Head South
    const divHeadId = 'u-1772263710177';

    // Query 1: What the code should run for Div Head
    const divHeadInvoices = await Invoice.find({
        $or: [
            { assignedDivHead: divHeadId },
            { status: 'Pending Div Head Review' }
        ]
    }).lean();

    console.log(`\n=== Div Head Query (assignedDivHead: ${divHeadId} OR status: Pending Div Head Review) ===`);
    console.log(`Found: ${divHeadInvoices.length} invoices`);
    divHeadInvoices.forEach(inv => {
        console.log(`  - ${inv.invoiceNumber} [${inv.id}] status: "${inv.status}" assignedDivHead: "${inv.assignedDivHead}" deptHeadApproval: ${inv.deptHeadApproval?.status}`);
    });

    // Query 2: All invoices with any div-head related status
    const allDivRelated = await Invoice.find({
        status: { $in: ['Pending Div Head Review', 'Div Head Approved', 'Div Head Rejected'] }
    }).lean();
    console.log(`\n=== All Div-Head Related Invoices ===`);
    console.log(`Found: ${allDivRelated.length} invoices`);
    allDivRelated.forEach(inv => {
        console.log(`  - ${inv.invoiceNumber} [${inv.id}] status: "${inv.status}" assignedDivHead: "${inv.assignedDivHead}"`);
    });

    // Query 3: Check all unique statuses
    const statuses = await Invoice.distinct('status');
    console.log(`\n=== All Unique Invoice Statuses ===`);
    statuses.forEach(s => console.log(`  - "${s}"`));

    process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
