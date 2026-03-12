/**
 * Migration script: Consolidate MongoDB collections into three categorized collections
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';

import('mongoose').then(async ({ default: mongoose }) => {
    const MONGODB_URI = process.env.MONGODB_URI;
    const logFile = 'migration_error_debug.txt';
    fs.writeFileSync(logFile, 'Migration Log Start\n');

    if (!MONGODB_URI) {
        fs.appendFileSync(logFile, 'MONGODB_URI environment variable is not set\n');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection.db || (mongoose.connection.client && mongoose.connection.client.db());
        if (!db) {
            throw new Error('Database connection established but db object is missing');
        }

        // Statistics tracking
        const stats = {
            users: 0,
            vendors: 0,
            projects: 0,
            purchaseOrders: 0,
            rateCards: 0,
            delegations: 0,
            auditTrails: 0,
            otps: 0,
            documentUploads: 0,
            notifications: 0,
            messages: 0,
            annexures: 0,
            errors: []
        };

        // === MIGRATE VENDORS → admin_data ===
        console.log('📦 Migrating vendors...');
        const vendors = await db.collection('vendors').find({}).toArray();
        if (vendors.length > 0) {
            const adminDocs = vendors.map(v => ({
                ...v,
                id: v.id || v._id.toString(),
                kind: 'Vendor',
                migrated: new Date()
            }));
            await db.collection('admin_data').insertMany(adminDocs);
            stats.vendors = vendors.length;
            console.log(`   ✅ Migrated ${vendors.length} vendors`);
        } else {
            console.log('   ℹ️ No vendors found');
        }

        // === MIGRATE PROJECTS → admin_data ===
        console.log('📦 Migrating projects...');
        const projects = await db.collection('projects').find({}).toArray();
        if (projects.length > 0) {
            const adminDocs = projects.map(p => ({
                ...p,
                id: p.id || p._id.toString(),
                kind: 'Project',
                migrated: new Date()
            }));
            await db.collection('admin_data').insertMany(adminDocs);
            stats.projects = projects.length;
            console.log(`   ✅ Migrated ${projects.length} projects`);
        } else {
            console.log('   ℹ️ No projects found');
        }

        // === MIGRATE PURCHASE_ORDERS → admin_data ===
        console.log('📦 Migrating purchase_orders...');
        const purchaseOrders = await db.collection('purchase_orders').find({}).toArray();
        if (purchaseOrders.length > 0) {
            const adminDocs = purchaseOrders.map(po => ({
                ...po,
                id: po.id || po._id.toString(),
                kind: 'PurchaseOrder',
                migrated: new Date()
            }));
            await db.collection('admin_data').insertMany(adminDocs);
            stats.purchaseOrders = purchaseOrders.length;
            console.log(`   ✅ Migrated ${purchaseOrders.length} purchase orders`);
        } else {
            console.log('   ℹ️ No purchase orders found');
        }

        // === MIGRATE RATE_CARDS → admin_data ===
        console.log('📦 Migrating rate_cards...');
        const rateCards = await db.collection('rate_cards').find({}).toArray();
        if (rateCards.length > 0) {
            const adminDocs = rateCards.map(rc => ({
                ...rc,
                id: rc.id || rc._id.toString(),
                kind: 'RateCard',
                migrated: new Date()
            }));
            await db.collection('admin_data').insertMany(adminDocs);
            stats.rateCards = rateCards.length;
            console.log(`   ✅ Migrated ${rateCards.length} rate cards`);
        } else {
            console.log('   ℹ️ No rate cards found');
        }

        // === MIGRATE DELEGATIONS → admin_data ===
        console.log('📦 Migrating delegations...');
        const delegations = await db.collection('delegations').find({}).toArray();
        if (delegations.length > 0) {
            const adminDocs = delegations.map(d => ({
                ...d,
                id: d.id || d._id.toString(),
                kind: 'Delegation',
                migrated: new Date()
            }));
            await db.collection('admin_data').insertMany(adminDocs);
            stats.delegations = delegations.length;
            console.log(`   ✅ Migrated ${delegations.length} delegations`);
        } else {
            console.log('   ℹ️ No delegations found');
        }

        // === MIGRATE AUDIT_TRAILS → admin_data ===
        console.log('📦 Migrating audit_trails...');
        const auditTrails = await db.collection('audit_trails').find({}).toArray();
        if (auditTrails.length > 0) {
            const adminDocs = auditTrails.map(at => ({
                ...at,
                id: at.id || at._id.toString(),
                kind: 'AuditTrail',
                migrated: new Date()
            }));
            await db.collection('admin_data').insertMany(adminDocs);
            stats.auditTrails = auditTrails.length;
            console.log(`   ✅ Migrated ${auditTrails.length} audit trails`);
        } else {
            console.log('   ℹ️ No audit trails found');
        }

        // === MIGRATE OTPS → internal_data ===
        console.log('📦 Migrating otps...');
        const otps = await db.collection('otps').find({}).toArray();
        if (otps.length > 0) {
            const internalDocs = otps.map(o => ({
                ...o,
                id: o.id || o._id.toString(),
                kind: 'Otp',
                migrated: new Date()
            }));
            await db.collection('internal_data').insertMany(internalDocs);
            stats.otps = otps.length;
            console.log(`   ✅ Migrated ${otps.length} OTPs`);
        } else {
            console.log('   ℹ️ No OTPs found');
        }

        // === MIGRATE DOCUMENT_UPLOADS → internal_data ===
        console.log('📦 Migrating document_uploads...');
        const documentUploads = await db.collection('document_uploads').find({}).toArray();
        if (documentUploads.length > 0) {
            const internalDocs = documentUploads.map(du => ({
                ...du,
                id: du.id || du._id.toString(),
                kind: 'DocumentUpload',
                migrated: new Date()
            }));
            await db.collection('internal_data').insertMany(internalDocs);
            stats.documentUploads = documentUploads.length;
            console.log(`   ✅ Migrated ${documentUploads.length} document uploads`);
        } else {
            console.log('   ℹ️ No document uploads found');
        }

        // === MIGRATE NOTIFICATIONS → internal_data ===
        console.log('📦 Migrating notifications...');
        const notifications = await db.collection('notifications').find({}).toArray();
        if (notifications.length > 0) {
            const internalDocs = notifications.map(n => ({
                ...n,
                id: n.id || n._id.toString(),
                kind: 'Notification',
                migrated: new Date()
            }));
            await db.collection('internal_data').insertMany(internalDocs);
            stats.notifications = notifications.length;
            console.log(`   ✅ Migrated ${notifications.length} notifications`);
        } else {
            console.log('   ℹ️ No notifications found');
        }

        // === MIGRATE MESSAGES → internal_data ===
        console.log('📦 Migrating messages...');
        const messages = await db.collection('messages').find({}).toArray();
        if (messages.length > 0) {
            const internalDocs = messages.map(m => ({
                ...m,
                id: m.id || m._id.toString(),
                kind: 'Message',
                migrated: new Date()
            }));
            await db.collection('internal_data').insertMany(internalDocs);
            stats.messages = messages.length;
            console.log(`   ✅ Migrated ${messages.length} messages`);
        } else {
            console.log('   ℹ️ No messages found');
        }

        // === MIGRATE ANNEXURES → internal_data ===
        console.log('📦 Migrating annexures...');
        const annexures = await db.collection('annexures').find({}).toArray();
        if (annexures.length > 0) {
            const internalDocs = annexures.map(a => ({
                ...a,
                id: a.id || a._id.toString(),
                kind: 'Annexure',
                migrated: new Date()
            }));
            await db.collection('internal_data').insertMany(internalDocs);
            stats.annexures = annexures.length;
            console.log(`   ✅ Migrated ${annexures.length} annexures`);
        } else {
            console.log('   ℹ️ No annexures found');
        }

        // === VERIFY USERS collection ===
        console.log('📦 Verifying users collection...');
        const users = await db.collection('users').countDocuments({});
        stats.users = users;
        console.log(`   ✅ Found ${users} users (no migration needed)\n`);

        // Index for admin_data (kind + id + created_at)
        await db.collection('admin_data').createIndex({ kind: 1 }, { background: true });
        await db.collection('admin_data').createIndex({ id: 1 }, { unique: true, background: true });
        await db.collection('admin_data').createIndex({ created_at: -1 }, { background: true });
        console.log('   ✅ Created indexes for admin_data');

        // Index for internal_data (kind + id + created_at + expiresAt for TTL)
        await db.collection('internal_data').createIndex({ kind: 1 }, { background: true });
        await db.collection('internal_data').createIndex({ id: 1 }, { unique: true, background: true });
        await db.collection('internal_data').createIndex({ created_at: -1 }, { background: true });
        await db.collection('internal_data').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });
        console.log('   ✅ Created indexes for internal_data');

        // Index for users (id + email)
        try {
            await db.collection('users').createIndex({ id: 1 }, { unique: true, background: true });
            await db.collection('users').createIndex({ email: 1 }, { unique: true, background: true });
        } catch (e) {
            console.log('   ℹ️ Users indexes already exist or have conflicts, skipping...');
        }
        console.log('   ✅ Created/verified indexes for users\n');

        // === VERIFY MIGRATION ===
        console.log('🔍 Verifying migration...');

        const adminDataCount = await db.collection('admin_data').countDocuments();
        const expectedAdmin = stats.vendors + stats.projects + stats.purchaseOrders +
            stats.rateCards + stats.delegations + stats.auditTrails;

        const internalDataCount = await db.collection('internal_data').countDocuments();
        const expectedInternal = stats.otps + stats.documentUploads + stats.notifications +
            stats.messages + stats.annexures;

        console.log(`   admin_data: ${adminDataCount} documents (expected: ${expectedAdmin})`);
        console.log(`   internal_data: ${internalDataCount} documents (expected: ${expectedInternal})`);

        if (adminDataCount !== expectedAdmin || internalDataCount !== expectedInternal) {
            console.error('\n⚠️  MIGRATION VERIFICATION FAILED: Counts do not match!');
            stats.errors.push('Verification failed: document counts do not match expected values');
        } else {
            console.log('   ✅ Migration verification passed\n');
        }

        // === SUMMARY ===
        console.log('═══════════════════════════════════════════════════');
        console.log('📊 MIGRATION SUMMARY');
        console.log('═══════════════════════════════════════════════════');
        console.log(`Users:           ${stats.users.toString().padStart(6)} (no migration)`);
        console.log(`Vendors:         ${stats.vendors.toString().padStart(6)} → admin_data`);
        console.log(`Projects:        ${stats.projects.toString().padStart(6)} → admin_data`);
        console.log(`Purchase Orders: ${stats.purchaseOrders.toString().padStart(6)} → admin_data`);
        console.log(`Rate Cards:      ${stats.rateCards.toString().padStart(6)} → admin_data`);
        console.log(`Delegations:     ${stats.delegations.toString().padStart(6)} → admin_data`);
        console.log(`Audit Trails:    ${stats.auditTrails.toString().padStart(6)} → admin_data`);
        console.log(`OTPs:            ${stats.otps.toString().padStart(6)} → internal_data`);
        console.log(`Doc Uploads:     ${stats.documentUploads.toString().padStart(6)} → internal_data`);
        console.log(`Notifications:   ${stats.notifications.toString().padStart(6)} → internal_data`);
        console.log(`Messages:        ${stats.messages.toString().padStart(6)} → internal_data`);
        console.log(`Annexures:       ${stats.annexures.toString().padStart(6)} → internal_data`);
        console.log('═══════════════════════════════════════════════════');

        const totalMigrated = adminDataCount + internalDataCount;
        console.log(`\n✅ Successfully migrated ${totalMigrated} documents in total`);

        if (stats.errors.length > 0) {
            console.log('\n⚠️  ERRORS encountered:');
            stats.errors.forEach(err => console.log(`   - ${err}`));
            console.log('\n⚠️  Please review and fix errors before cleaning up old collections');
        } else {
            console.log('\n✅ Migration completed successfully!');
            console.log('\n📝 NEXT STEPS:');
            console.log('   1. Verify data integrity in new collections');
            console.log('   2. Test application with new models');
            console.log('   3. Backup old collections for rollback');
            console.log('   4. Run cleanup script to remove old collections:');
            console.log('      node scripts/cleanup-old-collections.mjs');
        }

    } catch (error) {
        fs.appendFileSync(logFile, `❌ MIGRATION FAILED: ${error.message}\n`);
        fs.appendFileSync(logFile, `${error.stack}\n`);
        console.error('\n❌ MIGRATION FAILED:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}).catch(err => {
    console.error('Failed to import mongoose:', err);
    process.exit(1);
});