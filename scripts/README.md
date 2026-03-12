# MongoDB Categorization Migration

This directory contains scripts to migrate the MongoDB database from multiple disparate collections into three categorized collections using Mongoose discriminators.

## Overview

The migration consolidates 11 separate collections into 3 categorized collections:

### Before Migration
- `users` - User accounts
- `vendors` - Vendor information
- `projects` - Project data
- `purchase_orders` - Purchase order records
- `rate_cards` - Rate card configurations
- `delegations` - Delegation assignments
- `audit_trails` - Audit trail logs
- `otps` - OTP records with TTL
- `document_uploads` - Document upload metadata
- `notifications` - Notification records
- `messages` - Message records
- `annexures` - Annexure data

### After Migration
- **`users`** - All user accounts (no discriminator needed)
- **`admin_data`** - Master/administrative data with discriminator `kind` field:
  - Vendor
  - Project
  - PurchaseOrder
  - RateCard
  - Delegation
  - AuditTrail
- **`internal_data`** - Ephemeral/utility data with discriminator `kind` field:
  - Otp
  - DocumentUpload
  - Notification
  - Message
  - Annexure

- **`invoices`** - Not migrated (kept as-is)

## Pre-migration Checklist

- [ ] Ensure you have a recent database backup
- [ ] Review migration script to understand data transformation
- [ ] Test migration in a development/staging environment first
- [ ] Commit all code changes to version control

## Migration Process

### Step 1: Run migration script

```bash
cd invoice_tracker
node scripts/migrate-to-categorized.mjs
```

This script will:
1. Connect to MongoDB using `MONGODB_URI` environment variable
2. Migrate data from old collections to new collections
3. Add `kind` discriminator field to all migrated documents
4. Create required indexes on new collections
5. Verify document counts
6. Display summary statistics

**Expected output:**
```
🔄 Starting migration to categorized collections...

✅ Connected to MongoDB

📦 Migrating vendors...
   ✅ Migrated 150 vendors
...
✅ Migration completed successfully!

📝 NEXT STEPS:
   1. Verify data integrity in new collections
   2. Test application with new models
   3. Backup old collections for rollback
   4. Run cleanup script to remove old collections
```

### Step 2: Verify migration

```bash
node scripts/verify-migration.mjs
```

This verification script checks:
- Collection document counts
- Discriminator distribution
- Index presence
- Duplicate ID detection
- Kind field presence
- Required fields
- Sample document quality

**Expected output:**
```
🔍 Starting migration verification...

✅ Connected to MongoDB

1️⃣  Verifying collection counts...
   users:            500 documents
   admin_data:       450 documents
   internal_data:    300 documents
   ...
✅ ALL VERIFICATIONS PASSED!
```

If verification fails:
1. Review error messages
2. Fix any issues manually or rerun migration with adjustments
3. Run verification again

### Step 3: Test application

Before cleaning up old collections:

1. Test critical application functionality:
   - User authentication and management
   - Vendor operations
   - Project management
   - Rate card operations
   - OTP generation and verification
   - Document uploads

2. Check for any errors in logs
3. Verify all API endpoints work correctly
4. Run existing test suite

### Step 4: Cleanup old collections

⚠️ **WARNING: This operation is irreversible!**

After thorough testing and backup confirmation:

```bash
node scripts/cleanup-old-collections.mjs
```

This script will delete the following collections:
- `vendors`
- `projects`
- `purchase_orders`
- `rate_cards`
- `delegations`
- `audit_trails`
- `otps`
- `document_uploads`
- `notifications`
- `messages`
- `annexures`

**Expected output:**
```
🧹 Starting cleanup of old collections...

✅ Connected to MongoDB

⚠️  WARNING: This will permanently delete the following collections:
   - vendors
   - projects
   ...
✅ Deleted collection 'vendors' (150 documents)
...
✅ Cleanup completed successfully!
```

## Rollback Procedure

If issues arise after migration:

1. **Before cleanup**: Simply restore from backup or delete new collections and old data remains intact

2. **After cleanup**: Restore from pre-migration backup until new collections are verified working

## Model Usage After Migration

### Non-discriminator models (Users):

```javascript
import { Users } from '@/models/Users';

// Direct usage
const user = await Users.findOne({ id: 'user123' });
await Users.create({ email: 'user@example.com', role: 'admin' });
```

### Discriminator models (Admin & Internal):

```javascript
import { Vendor, Project, RateCard } from '@/models/Admin';
import { Otp, DocumentUpload, Notification } from '@/models/Internal';

// Use .model property
const vendor = await Vendor.model.findOne({ id: 'vendor123' });
await Project.model.create({ name: 'New Project', kind: 'Project' });
await RateCard.model.find({ projectId: 'project456' });

// Same pattern for Internal models
const otp = await Otp.model.findOne({ token: 'abc123' });
await DocumentUpload.model.find({ invoiceId: 'invoice789' });
```

## Technical Details

### Discriminator Schema

The `kind` field in `admin_data` and `internal_data` collections identifies the document type:

**admin_data kinds:**
- `Vendor` - Vendor information
- `Project` - Project metadata
- `PurchaseOrder` - Purchase order data
- `RateCard` - Rate card configuration
- `Delegation` - Delegation assignments
- `AuditTrail` - Audit log entries

**internal_data kinds:**
- `Otp` - One-time password with TTL
- `DocumentUpload` - Document upload metadata
- `Notification` - Notification records
- `Message` - Message data
- `Annexure` - Annexure information

### Indexes created

**users:**
- `id` (unique)
- `email`

**admin_data:**
- `kind`
- `id` (unique)
- `created_at` (descending)

**internal_data:**
- `kind`
- `id` (unique)
- `created_at` (descending)
- `expiresAt` (TTL index for automatic expiration)

### Data preservation

All data fields are preserved during migration. The only addition is the `kind` discriminator field and a `migrated` timestamp for tracking.

## Troubleshooting

### Migration fails mid-process

1. Check error logs for specific failures
2. The script does partial commits - some data may be in new collections
3. Either fix and rerun or rollback from backup
4. Verify script can handle duplicate documents (it doesn't skip them)

### Verification shows missing indexes

1. Run migration script again (idempotent for indexes)
2. Or manually create indexes using MongoDB shell

### Application errors after migration

1. Verify all model imports have been updated
2. Check for proper `.model` property usage with discriminators
3. Ensure environment points to migrated database
4. Check MongoDB logs for connection issues

## Security Requirements

Set the `MONGODB_URI` environment variable before running scripts:

```bash
export MONGODB_URI="mongodb://username:password@host:port/database"
# or use a .env file
```

## Support

For issues or questions:
1. Check this README for troubleshooting steps
2. Review script logs for error details
3. Contact the development team for database-related issues
4. Ensure backups are available before attempting rollback

## Future Considerations

- Monitor disk usage with 3 collections vs. original 11
- Performance of discriminator queries vs. separate collections
- TTL index effectiveness for OTP expiration
- Index utilization after migration
- Consider adding additional indexes based on query patterns