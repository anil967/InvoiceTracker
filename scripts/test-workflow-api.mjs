
import { SignJWT } from 'jose';
import mongoose from 'mongoose';

const secret = new TextEncoder().encode('your-secret-key-at-least-32-chars-long');

async function encrypt(payload) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret);
}

async function testWorkflow() {
    let invoiceId;
    try {
        await mongoose.connect('mongodb+srv://invoice:invoice1234@test.a0dvdj9.mongodb.net/invoice_tracker_db?retryWrites=true&w=majority&appName=test');
        console.log('Connected to DB');

        const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', new mongoose.Schema({}, { strict: false }));

        // 1. Find an invoice that is 'Pending Finance Review'
        const inv = await Invoice.findOne({ status: 'Pending Finance Review' });
        if (!inv) {
            console.log('No invoice found in Pending Finance Review state.');
            return;
        }
        invoiceId = inv.id;
        console.log(`Found invoice: ${invoiceId} - ${inv.invoiceNumber} with status ${inv.status}`);

        // 2. Generate Admin Session Cookie
        const adminUser = {
            id: 'u-1739812988894', // Example Admin ID
            email: 'admin@company.com',
            role: 'Admin',
            name: 'System Admin'
        };
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const sessionToken = await encrypt({ user: adminUser, expires });

        // 3. Make the API Call to workflow endpoint
        // Simulate clicking 'Finance Approve' logically by an Admin
        console.log('Calling API...');
        const res = await fetch(`http://127.0.0.1:3000/api/invoices/${invoiceId}/workflow`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `session=${sessionToken}`
            },
            body: JSON.stringify({
                action: 'APPROVE',
                comments: 'Admin verified fix',
                userRole: 'Finance User' // The workflow API uses this to decide which nested object to update
            })
        });

        let data;
        const text = await res.text();
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse JSON. HTTP Status:', res.status);
            console.error('Raw Body:', text.substring(0, 500));
            return;
        }
        console.log('API Response:', JSON.stringify(data, null, 2));

        // 4. Verify DB update
        const updatedInv = await Invoice.findOne({ _id: inv._id });
        import('fs').then(fs => {
            fs.writeFileSync('scripts/test-result.json', JSON.stringify({
                status: updatedInv.status,
                financeApproval: updatedInv.financeApproval
            }, null, 2));
            console.log('Saved to test-result.json');
        });

    } catch (err) {
        console.error('Test failed:', err.message);
        if (err.cause) console.error('Cause:', err.cause.message);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

testWorkflow();
