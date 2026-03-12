/**
 * diagnose-fq.mjs  
 * Full diagnostic: shows all FU/PM users with their managedBy links,
 * and all invoices in Pending Finance Review with their assignedFinanceUser state.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema(
    { id: String, name: String, email: String, role: String, managedBy: String },
    { collection: 'users' }
);
const InvoiceSchema = new mongoose.Schema(
    { id: String, status: String, assignedPM: String, assignedFinanceUser: String, invoiceNumber: String },
    { collection: 'invoices' }
);

const User = mongoose.models?.FQUser || mongoose.model('FQUser', UserSchema);
const Invoice = mongoose.models?.FQInvoice || mongoose.model('FQInvoice', InvoiceSchema);

async function diagnose() {
    await mongoose.connect(MONGODB_URI);

    const users = await User.find({}).lean();

    const admins = users.filter(u => u.role?.toLowerCase().includes('admin'));
    const fus = users.filter(u => u.role?.toLowerCase().includes('finance'));
    const pms = users.filter(u => u.role?.toLowerCase().includes('project') || u.role?.toLowerCase().includes('pm'));

    console.log('\n=== USERS ===');
    console.log('Admins:', admins.map(u => `${u.name} [${u.id}]`));
    console.log('Finance Users:', fus.map(u => `${u.name} [${u.id}] managedBy=${u.managedBy || 'NONE'}`));
    console.log('Project Managers:', pms.map(u => `${u.name} [${u.id}] managedBy=${u.managedBy || 'NONE'}`));

    console.log('\n=== FINANCE QUEUE INVOICES ===');
    const financeInvoices = await Invoice.find({
        status: { $in: ['Pending Finance Review', 'Finance Approved', 'Finance Rejected'] }
    }).lean();

    if (financeInvoices.length === 0) {
        console.log('No invoices in Finance states found.');
    } else {
        for (const inv of financeInvoices) {
            const pmUser = users.find(u => u.id === inv.assignedPM);
            const fuUser = users.find(u => u.id === inv.assignedFinanceUser);
            const managedByFu = pmUser?.managedBy
                ? users.find(u => u.id === pmUser.managedBy)
                : null;

            console.log(`\nInvoice: ${inv.invoiceNumber || inv.id}`);
            console.log(`  Status: ${inv.status}`);
            console.log(`  assignedPM: ${pmUser ? `${pmUser.name} (${pmUser.id})` : inv.assignedPM || 'NONE'}`);
            console.log(`  PM managedBy (should be FU): ${managedByFu ? `${managedByFu.name} (${managedByFu.id})` : pmUser?.managedBy || 'NOT SET'}`);
            console.log(`  assignedFinanceUser: ${fuUser ? `${fuUser.name} (${fuUser.id})` : inv.assignedFinanceUser || '❌ NOT SET'}`);

            if (inv.assignedFinanceUser && fuUser) {
                console.log(`  ✅ This invoice WILL appear for FU: ${fuUser.email}`);
            } else {
                console.log(`  ❌ This invoice WILL NOT appear in any FU queue`);
            }
        }
    }

    await mongoose.disconnect();
}

diagnose().catch(console.error);
