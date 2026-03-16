import { MongoClient } from 'mongodb';
import 'dotenv/config';
import readline from 'readline';

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error("Error: MONGODB_URI is not defined in .env");
    process.exit(1);
}

const client = new MongoClient(uri);

// Target vendor emails to remove
const EMAILS_TO_REMOVE = [
    'vendorr1@gmail.com',
    'testvendor_new@test.com',
    'biswajitdash929@gmail.com'
];

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const BACKUP = args.includes('--backup');
const SKIP_CONFIRM = args.includes('--yes');

/**
 * Backup data to JSON file
 */
async function backupVendorData(db, vendorData) {
    const fs = await import('fs');
    const backupData = {
        timestamp: new Date().toISOString(),
        vendors: vendorData
    };
    
    const backupPath = './vendor-removal-backup.json';
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`\n Backup saved to: ${backupPath}`);
}

/**
 * Prompt for confirmation
 */
function askConfirmation() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('\n Are you sure you want to permanently delete these vendors? (yes/no): ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

/**
 * Find and collect all vendor-related data
 */
async function collectVendorData(db, email) {
    const data = { email, collections: {} };
    
    // Find user first
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (!user) {
        return null;
    }
    
    const userId = user.id;
    const vendorId = user.vendorId;
    data.user = user;
    
    // Collect data from all collections
    data.collections.users = await db.collection('users').find({ id: userId }).toArray();
    data.collections.vendors = await db.collection('vendors').find({ 
        $or: [{ id: vendorId }, { linkedUserId: userId }] 
    }).toArray();
    data.collections.invoices = await db.collection('invoices').find({ submittedByUserId: userId }).toArray();
    data.collections.dist_invoices = await db.collection('dist_invoices').find({ submittedByUserId: userId }).toArray();
    data.collections.document_uploads = await db.collection('document_uploads').find({ uploadedBy: userId }).toArray();
    data.collections.notifications = await db.collection('notifications').find({ recipient_email: email.toLowerCase() }).toArray();
    data.collections.messages = await db.collection('messages').find({ 
        $or: [{ senderId: userId }, { recipientId: userId }] 
    }).toArray();
    data.collections.otps = await db.collection('otps').find({ email: email.toLowerCase() }).toArray();
    
    // Admin DB collections
    data.collections.rate_cards = await db.collection('rate_cards').find({ createdBy: email }).toArray();
    data.collections.purchase_orders = await db.collection('purchase_orders').find({ vendorId: vendorId }).toArray();
    data.collections.audit_trails = await db.collection('audit_trails').find({ username: email }).toArray();
    
    return data;
}

/**
 * Delete vendor data from all collections
 */
async function deleteVendorData(db, email, userId, vendorId) {
    const results = { email, deletions: {} };
    
    // Users
    const userDel = await db.collection('users').deleteMany({ id: userId });
    results.deletions.users = userDel.deletedCount;
    
    // Vendors (by ID and linkedUserId)
    if (vendorId) {
        const vendorDel = await db.collection('vendors').deleteMany({ id: vendorId });
        results.deletions.vendors = vendorDel.deletedCount;
    }
    const vendorLinkedDel = await db.collection('vendors').deleteMany({ linkedUserId: userId });
    results.deletions.vendors = (results.deletions.vendors || 0) + vendorLinkedDel.deletedCount;
    
    // Invoices (both collections)
    const invDel = await db.collection('dist_invoices').deleteMany({ submittedByUserId: userId });
    const invDel2 = await db.collection('invoices').deleteMany({ submittedByUserId: userId });
    results.deletions.invoices = invDel.deletedCount + invDel2.deletedCount;
    
    // Document Uploads
    const docDel = await db.collection('document_uploads').deleteMany({ uploadedBy: userId });
    results.deletions.document_uploads = docDel.deletedCount;
    
    // Notifications
    const notifDel = await db.collection('notifications').deleteMany({ recipient_email: email.toLowerCase() });
    results.deletions.notifications = notifDel.deletedCount;
    
    // Messages
    const msgDel = await db.collection('messages').deleteMany({ 
        $or: [{ senderId: userId }, { recipientId: userId }] 
    });
    results.deletions.messages = msgDel.deletedCount;
    
    // OTPs
    const otpDel = await db.collection('otps').deleteMany({ email: email.toLowerCase() });
    results.deletions.otps = otpDel.deletedCount;
    
    // Admin DB collections
    const rateCardDel = await db.collection('rate_cards').deleteMany({ createdBy: email });
    results.deletions.rate_cards = rateCardDel.deletedCount;
    
    const poDel = await db.collection('purchase_orders').deleteMany({ vendorId: vendorId });
    results.deletions.purchase_orders = poDel.deletedCount;
    
    const auditDel = await db.collection('audit_trails').deleteMany({ username: email });
    results.deletions.audit_trails = auditDel.deletedCount;
    
    return results;
}

/**
 * Main removal function
 */
async function removeVendors() {
    try {
        await client.connect();
        const db = client.db('invoice_tracker_db');
        
        console.log('===========================================');
        console.log('       VENDOR REMOVAL SCRIPT');
        console.log('===========================================');
        console.log(`\n Target emails: ${EMAILS_TO_REMOVE.join(', ')}`);
        console.log(`\n Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE DELETE'}`);
        if (BACKUP) console.log(` Backup: ENABLED`);
        
        // Phase 1: Discovery
        console.log('\n--- Phase 1: Discovering Vendor Data ---\n');
        
        const vendorData = [];
        const vendorsToRemove = [];
        
        for (const email of EMAILS_TO_REMOVE) {
            console.log(`Searching: ${email}`);
            const data = await collectVendorData(db, email);
            
            if (!data) {
                console.log(`  No user found. Skipping.\n`);
                continue;
            }
            
            vendorData.push(data);
            vendorsToRemove.push({
                email,
                userId: data.user.id,
                vendorId: data.user.vendorId
            });
            
            // Count total records
            let totalRecords = 0;
            for (const [collection, records] of Object.entries(data.collections)) {
                if (records.length > 0) {
                    console.log(`  ${collection}: ${records.length} record(s)`);
                    totalRecords += records.length;
                }
            }
            console.log(`  TOTAL: ${totalRecords} record(s)\n`);
        }
        
        if (vendorsToRemove.length === 0) {
            console.log('No vendors found matching the specified emails.');
            return;
        }
        
        // Phase 2: Backup (if requested)
        if (BACKUP && !DRY_RUN) {
            console.log('\n--- Phase 2: Creating Backup ---');
            await backupVendorData(db, vendorData);
        }
        
        // Phase 3: Confirmation
        if (!SKIP_CONFIRM && !DRY_RUN) {
            const confirmed = await askConfirmation();
            if (!confirmed) {
                console.log('\n Operation cancelled by user.');
                return;
            }
        }
        
        // Phase 4: Deletion
        if (DRY_RUN) {
            console.log('\n--- DRY RUN MODE - No deletions performed ---');
            console.log('\n Summary of what would be deleted:');
            for (const { email, userId, vendorId } of vendorsToRemove) {
                console.log(`\n ${email}:`);
                console.log(`   User ID: ${userId}`);
                console.log(`   Vendor ID: ${vendorId || 'N/A'}`);
                const data = vendorData.find(v => v.email === email);
                for (const [collection, records] of Object.entries(data.collections)) {
                    if (records.length > 0) {
                        console.log(`   ${collection}: ${records.length} record(s)`);
                    }
                }
            }
            return;
        }
        
        console.log('\n--- Phase 4: Deleting Vendor Data ---\n');
        
        const allResults = [];
        let totalDeleted = 0;
        
        for (const { email, userId, vendorId } of vendorsToRemove) {
            console.log(`Processing: ${email}`);
            const results = await deleteVendorData(db, email, userId, vendorId);
            allResults.push(results);
            
            let count = 0;
            for (const [collection, deleted] of Object.entries(results.deletions)) {
                if (deleted > 0) {
                    console.log(`  Deleted from ${collection}: ${deleted}`);
                    count += deleted;
                }
            }
            console.log(`  Subtotal: ${count} record(s)\n`);
            totalDeleted += count;
        }
        
        // Phase 5: Verification
        console.log('\n--- Phase 5: Verification ---\n');
        
        let verificationFailed = false;
        for (const email of EMAILS_TO_REMOVE) {
            const user = await db.collection('users').findOne({ email: email.toLowerCase() });
            if (user) {
                console.error(`  ERROR: User ${email} still exists!`);
                verificationFailed = true;
            } else {
                console.log(`  Verified: User ${email} is deleted.`);
            }
        }
        
        // Final Summary
        console.log('\n===========================================');
        console.log('               SUMMARY');
        console.log('===========================================');
        console.log(` Total vendors processed: ${vendorsToRemove.length}`);
        console.log(` Total records deleted: ${totalDeleted}`);
        if (verificationFailed) {
            console.log(` Status: COMPLETED WITH ERRORS`);
        } else {
            console.log(` Status: SUCCESS`);
        }
        console.log('===========================================\n');
        
    } catch (e) {
        console.error('Critical error during removal:', e);
        process.exit(1);
    } finally {
        await client.close();
    }
}

// Run the script
removeVendors();
