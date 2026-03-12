/**
 * fix-fq-comprehensive.mjs
 * Comprehensive fix for Finance Queue visibility.
 * 1. Shows all users and their hierarchy (managedBy)
 * 2. Shows all invoices in Finance-related statuses
 * 3. Attempts to auto-assign FU via multiple strategies
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const UserSchema = new mongoose.Schema(
    { id: String, name: String, email: String, role: String, managedBy: String, assignedProjects: [String] },
    { collection: 'users' }
);
const InvoiceSchema = new mongoose.Schema(
    { id: String, status: String, assignedPM: String, assignedFinanceUser: String, invoiceNumber: String, project: String, submittedByUserId: String },
    { collection: 'invoices' }
);

const User = mongoose.model('DiagUser', UserSchema);
const Invoice = mongoose.model('DiagInvoice', InvoiceSchema);

const users = await User.find({}).lean();
const userById = Object.fromEntries(users.map(u => [u.id, u]));

// Build managedBy index: FU_id -> list of PM ids
const pmsByFu = {};
for (const u of users) {
    if (u.managedBy && userById[u.managedBy]) {
        if (!pmsByFu[u.managedBy]) pmsByFu[u.managedBy] = [];
        pmsByFu[u.managedBy].push(u.id);
    }
}

console.log('\n====== USER HIERARCHY ======');
const fus = users.filter(u => u.role?.toLowerCase().includes('finance'));
for (const fu of fus) {
    const myPms = pmsByFu[fu.id] || [];
    console.log(`FU: ${fu.name} [${fu.id}]`);
    console.log(`  PMs under FU: ${myPms.map(id => `${userById[id]?.name} (${id})`).join(', ') || 'NONE'}`);
}

console.log('\n====== INVOICE DIAGNOSIS & FIX ======');
const financeInvoices = await Invoice.find({
    status: { $in: ['Pending Finance Review', 'Finance Approved', 'Finance Rejected'] }
}).lean();

console.log(`Total invoices in Finance states: ${financeInvoices.length}`);

let fixed = 0, alreadySet = 0, cantFix = 0;

for (const inv of financeInvoices) {
    const pmUser = userById[inv.assignedPM];
    const currentFu = userById[inv.assignedFinanceUser];

    process.stdout.write(`\nInvoice: ${inv.invoiceNumber || inv.id.slice(-10)}`);
    process.stdout.write(` | Status: ${inv.status}`);
    process.stdout.write(` | PM: ${pmUser?.name || inv.assignedPM || 'NONE'}`);
    process.stdout.write(` | FU: ${currentFu?.name || inv.assignedFinanceUser || 'NOT SET'}`);

    if (inv.assignedFinanceUser && currentFu) {
        process.stdout.write(' ✅\n');
        alreadySet++;
        continue;
    }

    // Strategy 1: Use PM's managedBy
    let resolvedFuId = null;
    if (pmUser?.managedBy) {
        const managerUser = userById[pmUser.managedBy];
        if (managerUser?.role?.toLowerCase().includes('finance')) {
            resolvedFuId = managerUser.id;
        }
    }

    // Strategy 2: Find FU whose PMs include this PM
    if (!resolvedFuId && inv.assignedPM) {
        for (const [fuId, pmIds] of Object.entries(pmsByFu)) {
            if (pmIds.includes(inv.assignedPM)) {
                const fuUser = userById[fuId];
                if (fuUser?.role?.toLowerCase().includes('finance')) {
                    resolvedFuId = fuId;
                    break;
                }
            }
        }
    }

    // Strategy 3: Look up vendor's submitter → their PM → then FU
    if (!resolvedFuId && inv.submittedByUserId) {
        const submitter = userById[inv.submittedByUserId];
        if (submitter?.managedBy) {
            const pm = userById[submitter.managedBy];
            if (pm?.managedBy) {
                const fu = userById[pm.managedBy];
                if (fu?.role?.toLowerCase().includes('finance')) {
                    resolvedFuId = fu.id;
                }
            }
        }
    }

    if (resolvedFuId) {
        await Invoice.findOneAndUpdate(
            { id: inv.id },
            { $set: { assignedFinanceUser: resolvedFuId } }
        );
        process.stdout.write(` → FIXED → ${userById[resolvedFuId]?.name} ✅\n`);
        fixed++;
    } else {
        process.stdout.write(' ❌ Could not resolve FU\n');
        cantFix++;
    }
}

console.log(`\n====== SUMMARY ======`);
console.log(`Already set: ${alreadySet}`);
console.log(`Fixed:       ${fixed}`);
console.log(`Cannot fix:  ${cantFix}`);

await mongoose.disconnect();
