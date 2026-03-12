const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://invoice:invoice1234@test.a0dvdj9.mongodb.net/invoice_tracker_db?retryWrites=true&w=majority&appName=test';

const UserSchema = new mongoose.Schema({ id: String, name: String, email: String, role: String, managedBy: String });
const InvoiceSchema = new mongoose.Schema({ id: String, invoiceNumber: String, status: String, assignedPM: String, assignedDeptHead: String, assignedDivHead: String, pmApproval: Object, deptHeadApproval: Object });

async function test() {
    await mongoose.connect(MONGODB_URI);
    const User = mongoose.model('User', UserSchema);
    const Invoice = mongoose.model('Invoice', InvoiceSchema);

    // Simulate the PM approve flow
    const pmId = 'pm-operations-001';
    const pmUser = await User.findOne({ id: pmId });
    console.log('PM User:', JSON.stringify({ id: pmUser?.id, name: pmUser?.name, managedBy: pmUser?.managedBy }));

    if (pmUser?.managedBy) {
        const deptUser = await User.findOne({ id: pmUser.managedBy });
        console.log('Dept Head (from managedBy):', JSON.stringify({ id: deptUser?.id, name: deptUser?.name, role: deptUser?.role }));

        // Check role normalization
        const rawRole = (deptUser?.role || '').toLowerCase();
        const isDeptHead = rawRole.includes('dept') || rawRole.includes('department');
        console.log('Is Dept Head?', isDeptHead, '(raw role:', deptUser?.role, ')');
    }

    // Now fix: update all invoices with status "Pending Dept Head Review" and null assignedDeptHead
    const deptHeadId = pmUser?.managedBy;
    if (deptHeadId) {
        const result = await Invoice.updateMany(
            { assignedPM: pmId, status: 'Pending Dept Head Review', assignedDeptHead: { $in: [null, ''] } },
            { $set: { assignedDeptHead: deptHeadId } }
        );
        console.log(`\nFixed ${result.modifiedCount} invoices - set assignedDeptHead to ${deptHeadId}`);
    }

    // Also check Dept Head -> Div Head hierarchy for future flow
    if (deptHeadId) {
        const deptUser = await User.findOne({ id: deptHeadId });
        if (deptUser?.managedBy) {
            const divUser = await User.findOne({ id: deptUser.managedBy });
            console.log('Div Head (from Dept Head managedBy):', JSON.stringify({ id: divUser?.id, name: divUser?.name, role: divUser?.role }));
        } else {
            console.log('WARNING: Dept Head has no managedBy set!');
        }
    }

    // Verify
    const fixed = await Invoice.find({ assignedPM: pmId, status: 'Pending Dept Head Review' }).select('id invoiceNumber assignedDeptHead').lean();
    console.log('\nVerification - invoices now:', JSON.stringify(fixed, null, 2));

    process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
