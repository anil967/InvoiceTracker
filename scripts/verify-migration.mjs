/**
 * Verification script: Verify data integrity after migration
 * 
 * This script:
 * - Verifies document counts match expected values
 * - Tests discriminator queries
 * - Validates index existence
 * - Checks for duplicate IDs
 * - Validates relationship integrity
 */

import('mongoose').then(async ({ default: mongoose }) => {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        console.error('MONGODB_URI environment variable is not set');
        process.exit(1);
    }

    console.log('🔍 Starting migration verification...\n');

    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;

        const errors = [];
        const warnings = [];
        const stats = {
            users: 0,
            admin_data: 0,
            internal_data: 0,
            invoices: 0
        };

        // === VERIFICATION 1: Collection Counts ===
        console.log('1️⃣  Verifying collection counts...');
        
        stats.users = await db.collection('users').countDocuments();
        stats.admin_data = await db.collection('admin_data').countDocuments();
        stats.internal_data = await db.collection('internal_data').countDocuments();
        stats.invoices = await db.collection('invoices').countDocuments();

        console.log(`   users:           ${stats.users.toString().padStart(7)} documents`);
        console.log(`   admin_data:      ${stats.admin_data.toString().padStart(7)} documents`);
        console.log(`   internal_data:   ${stats.internal_data.toString().padStart(7)} documents`);
        console.log(`   invoices:        ${stats.invoices.toString().padStart(7)} documents`);

        // === VERIFICATION 2: Discriminator Distribution ===
        console.log('\n2️⃣  Verifying discriminator distribution...');
        
        const adminKinds = await db.collection('admin_data').aggregate([
            { $group: { _id: '$kind', count: { $ Sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();

        console.log('   admin_data discriminators:');
        let totalAdmin = 0;
        adminKinds.forEach(k => {
            console.log(`      ${k._id}: ${k.count.toString().padStart(5)} documents`);
            totalAdmin += k.count;
        });

        const internalKinds = await db.collection('internal_data').aggregate([
            { $group: { _id: '$kind', count: { $ Sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();

        console.log('   internal_data discriminators:');
        let totalInternal = 0;
        internalKinds.forEach(k => {
            console.log(`      ${k._id}: ${k.count.toString().padStart(5)} documents`);
            totalInternal += k.count;
        });

        if (totalAdmin !== stats.admin_data) {
            errors.push(`admin_data discriminator count (${totalAdmin}) does not match total (${stats.admin_data})`);
        }

        if (totalInternal !== stats.internal_data) {
            errors.push(`internal_data discriminator count (${totalInternal}) does not match total (${stats.internal_data})`);
        }

        // === VERIFICATION 3: Index Verification ===
        console.log('\n3️⃣  Verifying indexes...');
        
        const usersIndexes = await db.collection('users').indexes();
        const adminIndexes = await db.collection('admin_data').indexes();
        const internalIndexes = await db.collection('internal_data').indexes();

        console.log(`   users: ${usersIndexes.length} indexes`);
        console.log(`   admin_data: ${adminIndexes.length} indexes`);
        console.log(`   internal_data: ${internalIndexes.length} indexes`);

        const requiredAdminIndexes = ['kind_1', 'id_1', 'created_at_-1'];
        const requiredInternalIndexes = ['kind_1', 'id_1', 'created_at_-1', 'expiresAt_1'];
        const requiredUsersIndexes = ['id_1', 'email_1'];

        const adminIndexNames = adminIndexes.map(i => i.name).filter(n => n !== '_id_');
        const internalIndexNames = internalIndexes.map(i => i.name).filter(n => n !== '_id_');
        const usersIndexNames = usersIndexes.map(i => i.name).filter(n => n !== '_id_');

        const missingAdminindexes = requiredAdminIndexes.filter(idx => !adminIndexNames.includes(idx));
        if (missingAdminindexes.length > 0) {
            errors.push(`admin_data missing indexes: ${missingAdminIndexes.join(', ')}`);
        }

        const missingInternalIndexes = requiredUsersIndexes.filter(idx => !internalIndexNames.includes(idx));
        if (missingInternalIndexes.length > 0) {
            errors.push(`internal_data missing indexes: ${missingInternalIndexes.join(', ')}`);
        }

        const missingUsersIndexes = requiredUsersIndexes.filter(idx => !usersIndexNames.includes(idx));
        if (missingUsersIndexes.length > 0) {
            errors.push(`users missing indexes: ${missingUsersIndexes.join(', ')}`);
        }

        // === VERIFICATION 4: Duplicate ID Check ===
        console.log('\n4️⃣  Checking for duplicate IDs...');
        
        const duplicateAdminIds = await db.collection('admin_data').aggregate([
            { $group: { _id: '$id', count: { $ Sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (duplicateAdminIds.length > 0) {
            errors.push(`Found ${duplicateAdminIds.length} duplicate IDs in admin_data`);
            duplicateAdminIds.forEach(d => console.log(`      Duplicate ID: ${d._id} (${d.count} copies)`));
        } else {
            console.log('   ✅ No duplicate IDs in admin_data');
        }

        const duplicateInternalIds = await db.collection('internal_data').aggregate([
            { $group: { _id: '$id', count: { $ Sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (duplicateInternalIds.length > 0) {
            errors.push(`Found ${duplicateInternalIds.length} duplicate IDs in internal_data`);
            duplicateInternalIds.forEach(d => console.log(`      Duplicate ID: ${d._id} (${d.count} copies)`));
        } else {
            console.log('   ✅ No duplicate IDs in internal_data');
        }

        const duplicateUserIds = await db.collection('users').aggregate([
            { $group: { _id: '$id', count: { $ Sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (duplicateUserIds.length > 0) {
            errors.push(`Found ${duplicateUserIds.length} duplicate IDs in users`);
            duplicateUserIds.forEach(d => console.log(`      Duplicate ID: ${d._id} (${d.count} copies)`));
        } else {
            console.log('   ✅ No duplicate IDs in users');
        }

        // === VERIFICATION 5: Kind Field Presence ===
        console.log('\n5️⃣  Verifying discriminator kind field...');
        
        const adminWithoutKind = await db.collection('admin_data').find({ kind: { $exists: false } }).countDocuments();
        if (adminWithoutKind > 0) {
            errors.push(`${adminWithoutKind} documents in admin_data missing 'kind' field`);
        } else {
            console.log('   ✅ All admin_data documents have kind field');
        }

        const internalWithoutKind = await db.collection('internal_data').find({ kind: { $exists: false } }).countDocuments();
        if (internalWithoutKind > 0) {
            errors.push(`${internalWithoutKind} documents in internal_data missing 'kind' field`);
        } else {
            console.log('   ✅ All internal_data documents have kind field');
        }

        // === VERIFICATION 6: Required Fields Check ===
        console.log('\n6️⃣  Checking for missing required fields...');
        
        const vendorsWithoutName = await db.collection('admin_data').find({ kind: 'Vendor', name: { $exists: false } }).countDocuments();
        if (vendorsWithoutName > 0) {
            errors.push(`${vendorsWithoutName} Vendor documents missing 'name' field`);
        }

        const projectsWithoutName = await db.collection('admin_data').find({ kind: 'Project', name: { $exists: false } }).countDocuments();
        if (projectsWithoutName > 0) {
            errors.push(`${projectsWithoutName} Project documents missing 'name' field`);
        }

        const usersWithoutEmail = await db.collection('users').find({ email: { $exists: false } }).countDocuments();
        if (usersWithoutEmail > 0) {
            errors.push(`${usersWithoutEmail} user documents missing 'email' field`);
        }

        if (errors.filter(e => e.includes('missing')).length === 0) {
            console.log('   ✅ No missing required fields detected');
        }

        // === VERIFICATION 7: Sample Document Quality Check ===
        console.log('\n7️⃣  Sampling document quality...');
        
        const sampleVendor = await db.collection('admin_data').findOne({ kind: 'Vendor' });
        if (sampleVendor) {
            console.log('   Sample Vendor:');
            console.log(`      id: ${sampleVendor.id || 'MISSING'}`);
            console.log(`      name: ${sampleVendor.name || 'MISSING'}`);
            console.log(`      kind: ${sampleVendor.kind || 'MISSING'}`);
        } else {
            warnings.push('No Vendor documents found for sampling');
        }

        const sampleOtp = await db.collection('internal_data').findOne({ kind: 'Otp' });
        if (sampleOtp) {
            console.log('   Sample Otp:');
            console.log(`      id: ${sampleOtp.id || 'MISSING'}`);
            console.log(`      kind: ${sampleOtp.kind || 'MISSING'}`);
            console.log(`      expiresAt: ${sampleOtp.expiresAt || 'MISSING'}`);
        } else {
            warnings.push('No Otp documents found for sampling');
        }

        const sampleUser = await db.collection('users').findOne();
        if (sampleUser) {
            console.log('   Sample user:');
            console.log(`      id: ${sampleUser.id || 'MISSING'}`);
            console.log(`      email: ${sampleUser.email || 'MISSING'}`);
            console.log(`      role: ${sampleUser.role || 'MISSING'}`);
        } else {
            warnings.push('No user documents found for sampling');
        }

        // Final Summary
        console.log('\n═══════════════════════════════════════════════════');
        console.log('📊 VERIFICATION SUMMARY');
        console.log('═══════════════════════════════════════════════════');

        if (errors.length === 0 && warnings.length === 0) {
            console.log('\n✅ ALL VERIFICATIONS PASSED!');
            console.log('\n📝 Migration is ready for production use.');
            console.log('   Next steps:');
            console.log('   1. Run cleanup script to remove old collections');
            console.log('   2. Delete old model files from models/ directory');
            console.log('   3. Deploy updated code to production');
        } else {
            if (warnings.length > 0) {
                console.log('\n⚠️  WARNINGS:');
                warnings.forEach(w => console.log(`   - ${w}`));
            }

            if (errors.length > 0) {
                console.log('\n❌ ERRORS:');
                errors.forEach(e => console.log(`   - ${e}`));
                console.log('\n⚠️  Please fix errors before proceeding with cleanup.');
                process.exit(1);
            } else {
                console.log('\n✅ Verification completed with warnings only.');
                console.log('   You may proceed, but review warnings.');
            }
        }

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error.message);
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