
import { db } from '../lib/db.js';

async function diagnose() {
    try {
        const inv = await db.getInvoice('INV-001');
        console.log('--- INV-001 DIAGNOSTIC ---');
        if (!inv) {
            console.log('Invoice not found: INV-001');
            return;
        }
        console.log('Status:', inv.status);
        console.log('PM Status:', inv.pmApproval?.status);
        console.log('Finance Status:', inv.financeApproval?.status);
        console.log('Finance Approval Data:', JSON.stringify(inv.financeApproval, null, 2));
        console.log('PM Approval Data:', JSON.stringify(inv.pmApproval, null, 2));
        console.log('--------------------------');
    } catch (err) {
        console.error('Diagnostic failed:', err);
    } finally {
        process.exit();
    }
}

diagnose();
