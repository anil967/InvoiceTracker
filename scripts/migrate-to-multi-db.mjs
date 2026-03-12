/**
 * Migration Script: Migrate from legacy "invoice_tracker_db" to multi-database structure
 * 
 * Sources:
 * 1. Categorized collections: admin_data, internal_data (split by 'kind')
 * 2. Standalone collections: users, vendors, projects, invoices, etc.
 * 
 * Targets: 3 separate databases (users, admin, internal_data)
 */

import mongoose from 'mongoose';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Get project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
config({ path: join(projectRoot, '.env') });

const LEGACY_DB_NAME = 'invoice_tracker_db';

// Parse the URI properly — the .env URI may or may not have a database name
const rawUri = process.env.MONGODB_URI || '';
const [uriWithoutParams, queryParams] = rawUri.split('?');
// For mongodb+srv:// the host part ends at .mongodb.net — strip any trailing /dbname
const MONGODB_URI_BASE = uriWithoutParams.replace(/\/[^/.]+$/, '');
const qs = queryParams ? `?${queryParams}` : '';

function dbUri(dbName) {
    return `${MONGODB_URI_BASE}/${dbName}${qs}`;
}

// New database names
const DB_MAP = {
    users: 'users',
    admin: 'admin_db',
    internal: 'internal_data'
};

/**
 * SOURCE → TARGET MAPPING
 * If a collection is in 'INTERNAL_SOURCES' or 'ADMIN_SOURCES', it will be split by 'kind'
 * Otherwise, it will be mapped as a direct source-to-target collection.
 */
const SOURCE_MAPPING = {
    // Discriminator collections (source -> target DB)
    'admin_data': DB_MAP.admin,
    'internal_data': DB_MAP.internal,

    // Standalone collections (source -> { targetDb, targetCollection })
    'users': { db: DB_MAP.users, col: 'users' },
    'vendors': { db: DB_MAP.admin, col: 'vendors' },
    'projects': { db: DB_MAP.admin, col: 'projects' },
    'purchase_orders': { db: DB_MAP.admin, col: 'purchase_orders' },
    'rate_cards': { db: DB_MAP.admin, col: 'rate_cards' },
    'delegations': { db: DB_MAP.admin, col: 'delegations' },
    'audit_trails': { db: DB_MAP.admin, col: 'audit_trails' },
    'invoices': { db: DB_MAP.internal, col: 'invoices' },
    'system_config': { db: DB_MAP.admin, col: 'system_config' },
    'otps': { db: DB_MAP.internal, col: 'otps' },
    'messages': { db: DB_MAP.internal, col: 'messages' },
    'notifications': { db: DB_MAP.internal, col: 'notifications' },
    'document_uploads': { db: DB_MAP.internal, col: 'document_uploads' },
    'annexures': { db: DB_MAP.internal, col: 'annexures' },
    'debuglogs': { db: DB_MAP.internal, col: 'debuglogs' }
};

/**
 * Discriminator Kind → Target Collection Mapping
 */
const KIND_MAPPING = {
    // Admin kinds
    'Vendor': 'vendors',
    'Project': 'projects',
    'PurchaseOrder': 'purchase_orders',
    'RateCard': 'rate_cards',
    'Delegation': 'delegations',
    'AuditTrail': 'audit_trails',
    // Internal kinds
    'Otp': 'otps',
    'DocumentUpload': 'document_uploads',
    'Notification': 'notifications',
    'Message': 'messages',
    'Annexure': 'annexures'
};

const stats = {
    total_found: 0,
    total_migrated: 0,
    total_skipped: 0,
    errors: []
};

async function migrate() {
    console.log('\n🚀 Starting Migration to Multi-Database Architecture');
    console.log('Legacy DB:', LEGACY_DB_NAME);
    console.log('Target DBs:', Object.values(DB_MAP).join(', '), '\n');

    let legacyConn, usersDb, adminDb, internalDb;

    try {
        // Connect to legacy DB
        legacyConn = await mongoose.createConnection(dbUri(LEGACY_DB_NAME)).asPromise();
        console.log('✅ Connected to Legacy DB');

        // Connect to target DBs
        usersDb = await mongoose.createConnection(dbUri(DB_MAP.users)).asPromise();
        adminDb = await mongoose.createConnection(dbUri(DB_MAP.admin)).asPromise();
        internalDb = await mongoose.createConnection(dbUri(DB_MAP.internal)).asPromise();
        console.log('✅ Connected to Target DBs\n');

        const targetConns = {
            [DB_MAP.users]: usersDb,
            [DB_MAP.admin]: adminDb,
            [DB_MAP.internal]: internalDb
        };

        const collections = await legacyConn.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        for (const sourceColName of Object.keys(SOURCE_MAPPING)) {
            if (!collectionNames.includes(sourceColName)) continue;

            console.log(`📡 Processing Source: ${sourceColName}...`);
            const sourceCol = legacyConn.db.collection(sourceColName);
            const mapping = SOURCE_MAPPING[sourceColName];

            const cursor = sourceCol.find({});

            while (await cursor.hasNext()) {
                const doc = await cursor.next();
                stats.total_found++;

                let targetDb, targetColName;

                if (sourceColName === 'admin_data' || sourceColName === 'internal_data') {
                    // Split discriminator document
                    const kind = doc.kind;
                    if (!kind || !KIND_MAPPING[kind]) {
                        console.warn(`  ⚠️ Skipping document ${doc._id} in ${sourceColName}: Unknown kind '${kind}'`);
                        stats.total_skipped++;
                        continue;
                    }
                    targetDb = targetConns[mapping];
                    targetColName = KIND_MAPPING[kind];
                } else {
                    // Direct standalone collection
                    targetDb = targetConns[mapping.db];
                    targetColName = mapping.col;
                }

                try {
                    // Clean up document for standalone collection
                    const cleanDoc = { ...doc };
                    delete cleanDoc.kind; // Strip discriminator key
                    delete cleanDoc._id;  // Strip _id to avoid conflicts on upsert

                    // Upsert by id
                    const idValue = cleanDoc.id || doc._id?.toString();
                    await targetDb.db.collection(targetColName).updateOne(
                        { id: idValue },
                        { $set: cleanDoc },
                        { upsert: true }
                    );
                    stats.total_migrated++;
                } catch (err) {
                    console.error(`  ❌ Error migrating doc ${doc._id} to ${targetColName}:`, err.message);
                    stats.errors.push({ id: doc._id, col: targetColName, error: err.message });
                }
            }
            console.log(`  Done with ${sourceColName}\n`);
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 MIGRATION SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Total Found:    ${stats.total_found}`);
        console.log(`Total Migrated: ${stats.total_migrated}`);
        console.log(`Total Skipped:  ${stats.total_skipped}`);
        console.log(`Total Errors:   ${stats.errors.length}`);

        if (stats.errors.length > 0) {
            console.log('\n❌ Errors Detail:');
            stats.errors.slice(0, 10).forEach(e => console.log(`  - ID: ${e.id}, Col: ${e.col}, Error: ${e.error}`));
            if (stats.errors.length > 10) console.log(`  ... and ${stats.errors.length - 10} more`);
        }

        console.log('\n✅ Migration finished successfully.');
        console.log('Legacy database has been kept as a backup.');

    } catch (err) {
        console.error('\n💥 FATAL ERROR during migration:', err);
    } finally {
        if (legacyConn) await legacyConn.close();
        if (usersDb) await usersDb.close();
        if (adminDb) await adminDb.close();
        if (internalDb) await internalDb.close();
        process.exit(stats.errors.length > 0 ? 1 : 0);
    }
}

migrate();
