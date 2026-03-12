/**
 * Cleanup script: Remove old collections after successful migration
 * 
 * This script will DELETE the following collections:
 * - vendors
 * - projects
 * - purchase_orders
 * - rate_cards
 * - delegations
 * - audit_trails
 * - otps
 * - document_uploads
 * - notifications
 * - messages
 * - annexures
 * 
 * WARNING: This operation is irreversible! Make sure to backup before running.
 */

import('mongoose').then(async ({ default: mongoose }) => {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        console.error('MONGODB_URI environment variable is not set');
        process.exit(1);
    }

    console.log('🧹 Starting cleanup of old collections...\n');

    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;

        const oldCollections = [
            'vendors',
            'projects',
            'purchase_orders',
            'rate_cards',
            'delegations',
            'audit_trails',
            'otps',
            'document_uploads',
            'notifications',
            'messages',
            'annexures'
        ];

        const stats = {
            deleted: 0,
            skipped: 0,
            errors: []
        };

        console.log('⚠️  WARNING: This will permanently delete the following collections:');
        oldCollections.forEach(col => console.log(`   - ${col}`));
        console.log('\nProceeding with cleanup...\n');

        for (const collectionName of oldCollections) {
            try {
                // Check if collection exists
                const collections = await db.listCollections({ name: collectionName }).toArray();
                
                if (collections.length === 0) {
                    console.log(`ℹ️  Collection '${collectionName}' does not exist, skipping...`);
                    stats.skipped++;
                    continue;
                }

                // Get document count before deletion
                const count = await db.collection(collectionName).countDocuments();
                
                // Drop collection
                await db.collection(collectionName).drop();
                
                console.log(`✅ Deleted collection '${collectionName}' (${count} documents)`);
                stats.deleted++;
                
            } catch (error) {
                if (error.message.includes('ns not found')) {
                    console.log(`ℹ️  Collection '${collectionName}' does not exist, skipped`);
                    stats.skipped++;
                } else {
                    console.error(`❌ Error deleting '${collectionName}':`, error.message);
                    stats.errors.push({ collection: collectionName, error: error.message });
                }
            }
        }

        // Summary
        console.log('\n═══════════════════════════════════════════════════');
        console.log('📊 CLEANUP SUMMARY');
        console.log('═══════════════════════════════════════════════════');
        console.log(`Collections deleted: ${stats.deleted}`);
        console.log(`Collections skipped: ${stats.skipped}`);
        console.log('═══════════════════════════════════════════════════');

        if (stats.errors.length > 0) {
            console.log('\n⚠️  ERRORS encountered:');
            stats.errors.forEach(err => console.log(`   - ${err.collection}: ${err.error}`));
        } else {
            console.log('\n✅ Cleanup completed successfully!');
            console.log('\n📝 Remaining collections:');
            const remainingCollections = await db.listCollections().toArray();
            remainingCollections.forEach(col => console.log(`   - ${col.name} (${await db.collection(col.name).countDocuments()} documents)`));
        }

    } catch (error) {
        console.error('\n❌ CLEANUP FAILED:', error.message);
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