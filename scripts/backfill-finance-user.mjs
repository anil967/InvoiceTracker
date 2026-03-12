/**
 * backfill-finance-user.mjs
 * Fixes existing invoices stuck in "Pending Finance Review" with no assignedFinanceUser.
 * Looks at each invoice's assignedPM, finds that PM's managedBy (their FU), and assigns it.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

const UserSchema = new mongoose.Schema({ id: String, name: String, email: String, role: String, managedBy: String }, { collection: 'users' });
const InvoiceSchema = new mongoose.Schema({ id: String, status: String, assignedPM: String, assignedFinanceUser: String }, { collection: 'invoices' });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);

async function backfill() {
    console.log('Connecting...');
    await mongoose.connect(MONGODB_URI);

    // Find all invoices in Finance Review with no assignedFinanceUser
    const stuck = await Invoice.find({
        status: 'Pending Finance Review',
        $or: [
            { assignedFinanceUser: { $exists: false } },
            { assignedFinanceUser: null },
            { assignedFinanceUser: '' }
        ]
    }).lean();

    console.log(`Found ${stuck.length} stuck invoices.`);

    let fixed = 0, skipped = 0;

    for (const inv of stuck) {
        if (!inv.assignedPM) {
            console.log(`[SKIP] Invoice ${inv.id} has no assignedPM`);
            skipped++;
            continue;
        }

        const pm = await User.findOne({ id: inv.assignedPM }).lean();
        if (!pm?.managedBy) {
            console.log(`[SKIP] PM ${inv.assignedPM} has no managedBy set (Invoice: ${inv.id})`);
            skipped++;
            continue;
        }

        const fu = await User.findOne({ id: pm.managedBy }).lean();
        if (!fu) {
            console.log(`[SKIP] managedBy=${pm.managedBy} not found in DB (Invoice: ${inv.id})`);
            skipped++;
            continue;
        }

        await Invoice.findOneAndUpdate(
            { id: inv.id },
            { $set: { assignedFinanceUser: fu.id } }
        );
        console.log(`[FIXED] Invoice ${inv.id} → assignedFinanceUser = ${fu.name} (${fu.id})`);
        fixed++;
    }

    console.log(`\nDone. Fixed: ${fixed}, Skipped: ${skipped}`);
    await mongoose.disconnect();
}

backfill().catch(console.error);
