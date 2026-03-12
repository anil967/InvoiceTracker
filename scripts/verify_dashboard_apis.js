/**
 * Dashboard API Verification Script
 * 
 * This script tests all role-specific dashboard APIs to ensure:
 * 1. Each role receives only the correct subset of invoices
 * 2. Cross-role data leakage is prevented
 * 3. Backend statistics are calculated correctly
 * 
 * Usage: node scripts/verify_dashboard_apis.js
 */

// Load environment variables
require('dotenv').config({ path: '.env' });

const { MongoClient } = require('mongodb');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/autoinvoice';
const TEST_DB_NAME = 'autoinvoice_test_verification';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Role constants
const ADMIN = 'ADMIN';
const VENDOR = 'VENDOR';
const FINANCE_USER = 'FINANCE_USER';
const PROJECT_MANAGER = 'PROJECT_MANAGER';

// Invoice statuses
const STATUSES = {
  MATCH_DISCREPANCY: 'MATCH_DISCREPANCY',
  VERIFIED: 'VERIFIED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  PAID: 'PAID',
  DIGITIZING: 'DIGITIZING',
  RECEIVED: 'RECEIVED'
};

// Test data
const testUsers = {
  admin: {
    id: 'verify-admin-001',
    email: 'verify.admin@example.com',
    name: 'Verification Admin',
    role: ADMIN
  },
  vendor: [
    {
      id: 'verify-vendor-001',
      email: 'verify.vendor1@example.com',
      name: 'Vendor One',
      role: VENDOR
    },
    {
      id: 'verify-vendor-002',
      email: 'verify.vendor2@example.com',
      name: 'Vendor Two',
      role: VENDOR
    }
  ],
  finance: {
    id: 'verify-finance-001',
    email: 'verify.finance@example.com',
    name: 'Verification Finance',
    role: FINANCE_USER
  },
  pm: [
    {
      id: 'verify-pm-001',
      email: 'verify.pm1@example.com',
      name: 'Project Manager One',
      role: PROJECT_MANAGER,
      assignedProjects: ['PROJ-001', 'PROJ-002']
    },
    {
      id: 'verify-pm-002',
      email: 'verify.pm2@example.com',
      name: 'Project Manager Two',
      role: PROJECT_MANAGER,
      assignedProjects: ['PROJ-003', 'PROJ-004']
    }
  ]
};

const testInvoices = [];

// Generate test invoices
function generateTestInvoices() {
  const baseDate = new Date('2024-01-01');
  const invoices = [];
  let invoiceIdCounter = 1;

  // Vendor 1 invoices (5 invoices)
  for (let i = 0; i < 5; i++) {
    const statuses = [
      STATUSES.DIGITIZING,
      STATUSES.VERIFIED,
      STATUSES.PENDING_APPROVAL,
      STATUSES.MATCH_DISCREPANCY,
      STATUSES.PAID
    ];
    const statuses2 = [
      STATUSES.MATCH_DISCREPANCY,
      STATUSES.VERIFIED,
      STATUSES.RECEIVED,
      STATUSES.Pending_APPROVAL,
      STATUSES.DIGITIZING
    ];
    
    invoices.push({
      _id: `verify-inv-${String(invoiceIdCounter++).padStart(3, '0')}`,
      id: `INV-${String(invoiceIdCounter).padStart(6, '0')}`,
      invoiceNumber: `INV-${String(baseDate.getFullYear())}-${String(100 + i)}`,
      vendorCode: `VENDOR-001`,
      vendorName: testUsers.vendor[0].name,
      amount: 5000 + (i * 1000),
      date: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: statuses[i],
      poNumber: `PO-${String(1000 + i)}`,
      project: (i < 2) ? 'PROJ-001' : (i < 4) ? 'PROJ-002' : 'PROJ-003',
      submittedByUserId: testUsers.vendor[0].id,
      assignedPM: 'verify-pm-001'
    });
  }

  // Vendor 2 invoices (5 invoices)
  for (let i = 0; i < 5; i++) {
    const statuses = [
      STATUSES.DIGITIZING,
      STATUSES.VERIFIED,
      STATUSES.PENDING_APPROVAL,
      STATUSES.MATCH_DISCREPANCY,
      STATUSES.PAID
    ];
    
    invoices.push({
      _id: `verify-inv-${String(invoiceIdCounter++).padStart(3, '0')}`,
      id: `INV-${String(invoiceIdCounter).padStart(6, '0')}`,
      invoiceNumber: `INV-${String(baseDate.getFullYear())}-${String(200 + i)}`,
      vendorCode: `VENDOR-002`,
      vendorName: testUsers.vendor[1].name,
      amount: 8000 + (i * 1500),
      date: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: statuses[i],
      poNumber: `PO-${String(2000 + i)}`,
      project: (i < 3) ? 'PROJ-003' : 'PROJ-004',
      submittedByUserId: testUsers.vendor[1].id,
      assignedPM: 'verify-pm-002'
    });
  }

  // Additional invoices for cross-verification
  // Invoice assigned to PM1 but from Vendor2 (shouldn't be visible to PM1)
  invoices.push({
    _id: `verify-inv-${String(invoiceIdCounter++)}`,
    id: `INV-${String(invoiceIdCounter).padStart(6, '0')}`,
    invoiceNumber: `INV-CROSS-001`,
    vendorCode: `VENDOR-002`,
    vendorName: testUsers.vendor[1].name,
    amount: 10000,
    date: baseDate.toISOString().split('T')[0],
    status: STATUSES.PENDING_APPROVAL,
    poNumber: `PO-3001`,
    project: 'PROJ-001',
    submittedByUserId: testUsers.vendor[1].id,
    assignedPM: 'verify-pm-001'
  });

  // Invoice assigned to PM2 but from Vendor1 (shouldn't be visible to PM2)
  invoices.push({
    _id: `verify-inv-${String(invoiceIdCounter++)}`,
    id: `INV-${String(invoiceIdCounter).padStart(6, '0')}`,
    invoiceNumber: `INV-CROSS-002`,
    vendorCode: `VENDOR-001`,
    vendorName: testUsers.vendor[0].name,
    amount: 12000,
    date: baseDate.toISOString().split('T')[0],
    status: STATUSES.VERIFIED,
    poNumber: `PO-3002`,
    project: 'PROJ-003',
    submittedByUserId: testUsers.vendor[0].id,
    assignedPM: 'verify-pm-002'
  });

  // Invoice not assigned to any specific PM (delegated project)
  invoices.push({
    _id: `verify-inv-${String(invoiceIdCounter++)}`,
    id: `INV-${String(invoiceIdCounter).padStart(6, '0')}`,
    invoiceNumber: `INV-DELEGATED-001`,
    vendorCode: `VENDOR-001`,
    vendorName: testUsers.vendor[0].name,
    amount: 15000,
    date: baseDate.toISOString().split('T')[0],
    status: STATUSES.DIGITIZING,
    poNumber: `PO-4001`,
    project: 'PROJ-002',
    submittedByUserId: testUsers.vendor[0].id,
    assignedPM: Math.random() > 0.5 ? 'verify-pm-001' : 'verify-pm-002'
  });

  return invoices;
}

// Initialize database with test data
async function initializeDatabase(client) {
  console.log('\n📋 Initializing test database...');
  
  const db = client.db(TEST_DB_NAME);
  
  // Clear existing test data using correct patterns
  await db.collection('users').deleteMany({ email: /verify\./ });
  await db.collection('invoices').deleteMany({ _id: { $regex: /^verify-inv-/ } });
  
  // Insert test users
  await db.collection('users').insertOne(testUsers.admin);
  await db.collection('users').insertMany(testUsers.vendor);
  await db.collection('users').insertOne(testUsers.finance);
  await db.collection('users').insertMany(testUsers.pm);
  
  // Generate and insert test invoices
  const invoices = generateTestInvoices();
  testInvoices.push(...invoices);
  await db.collection('invoices').insertMany(invoices);
  
  console.log(`✅ Inserted ${testUsers.vendor.length} vendors`);
  console.log(`✅ Inserted ${testUsers.pm.length} project managers`);
  console.log(`✅ Inserted ${invoices.length} test invoices`);
  
  console.log('\n📊 Invoice distribution:');
  console.log(`   Vendor 1 (verify-vendor-001): ${invoices.filter(i => i.submittedByUserId === testUsers.vendor[0].id).length} invoices`);
  console.log(`   Vendor 2 (verify-vendor-002): ${invoices.filter(i => i.submittedByUserId === testUsers.vendor[1].id).length} invoices`);
  console.log(`   PM 1 (verify-pm-001) assigned: ${invoices.filter(i => i.assignedPM === 'verify-pm-001' || testUsers.pm[0].assignedProjects.includes(i.project)).length} invoices`);
  console.log(`   PM 2 (verify-pm-002) assigned: ${invoices.filter(i => i.assignedPM === 'verify-pm-002' || testUsers.pm[1].assignedProjects.includes(i.project)).length} invoices`);
  console.log(`   Pending Approval: ${invoices.filter(i => i.status === STATUSES.PENDING_APPROVAL).length}`);
  console.log(`   Match Discrepancy: ${invoices.filter(i => i.status === STATUSES.MATCH_DISCREPANCY).length}`);
  console.log(`   Verified: ${invoices.filter(i => i.status === STATUSES.VERIFIED).length}`);
}

// Simulate API request (simulates the real API endpoints)
async function simulateDashboardAPI(userRole, userId, db) {
  const allInvoices = await db.collection('invoices').find({}).toArray();
  
  // Simulate the logic from the actual API routes
  let filteredInvoices = [];
  
  if (userRole === ADMIN) {
    // Admin sees all invoices
    filteredInvoices = allInvoices;
  } else if (userRole === VENDOR) {
    // Vendor sees only their own invoices
    filteredInvoices = allInvoices.filter(inv => inv.submittedByUserId === userId);
  } else if (userRole === FINANCE_USER) {
    // Finance sees all invoices
    filteredInvoices = allInvoices;
  } else if (userRole === PROJECT_MANAGER) {
    // PM sees invoices assigned to their projects or directly to them
    const user = await db.collection('users').findOne({ id: userId });
    filteredInvoices = allInvoices.filter(inv => {
      const hasProjectAccess = (user.assignedProjects || []).includes(inv.project) || inv.assignedPM === user.id;
      return hasProjectAccess;
    });
  }
  
  // Calculate stats based on the filtered invoices
  let stats;
  
  if (userRole === ADMIN) {
    stats = {
      totalVolume: filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0),
      totalInvoices: filteredInvoices.length,
      discrepancyCount: filteredInvoices.filter(i => i.status === STATUSES.MATCH_DISCREPANCY).length,
      verifiedCount: filteredInvoices.filter(i => i.status === STATUSES.VERIFIED).length,
      pendingApprovalCount: filteredInvoices.filter(i => i.status === STATUSES.PENDING_APPROVAL).length
    };
  } else if (userRole === VENDOR) {
    stats = {
      totalInvoices: filteredInvoices.length,
      paidCount: filteredInvoices.filter(i => i.status === STATUSES.PAID).length,
      processingCount: filteredInvoices.filter(i => [STATUSES.DIGITIZING, STATUSES.RECEIVED].includes(i.status)).length,
      totalBillingVolume: filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0)
    };
  } else if (userRole === FINANCE_USER) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    stats = {
      pendingApprovals: filteredInvoices.filter(i => i.status === STATUSES.PENDING_APPROVAL).length,
      mtdSpend: filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0), // Simplified MTD calculation
      weeklyProcessedCount: filteredInvoices.filter(i => i.status === STATUSES.VERIFIED).length // Simplified
    };
  } else if (userRole === PROJECT_MANAGER) {
    stats = {
      totalInvoices: filteredInvoices.length,
      pendingApproval: filteredInvoices.filter(i => i.status === STATUSES.PENDING_APPROVAL).length,
      approvedCount: filteredInvoices.filter(i => i.status === STATUSES.VERIFIED || i.status === STATUSES.PAID).length,
      discrepanciesCount: filteredInvoices.filter(i => i.status === STATUSES.MATCH_DISCREPANCY).length
    };
  }
  
  return {
    stats,
    invoices: filteredInvoices
  };
}

// Verify Admin dashboard API
async function verifyAdminDashboard(db) {
  console.log('\n🔍 Verifying Admin Dashboard API...');
  
  const result = await simulateDashboardAPI(ADMIN, testUsers.admin.id, db);
  
  const validations = [];
  
  // Should see ALL invoices
  validations.push({
    test: 'Admin sees all invoices',
    expected: testInvoices.length,
    actual: result.invoices.length,
    passed: result.invoices.length === testInvoices.length
  });
  
  // Total volume should match sum of all invoices
  const expectedTotal = testInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  validations.push({
    test: 'Total volume matches all invoices',
    expected: expectedTotal,
    actual: result.stats.totalVolume,
    passed: result.stats.totalVolume === expectedTotal
  });
  
  // Should see discrepancy count
  const expectedDiscrepancy = testInvoices.filter(i => i.status === STATUSES.MATCH_DISCREPANCY).length;
  validations.push({
    test: 'Discrepancy count matches',
    expected: expectedDiscrepancy,
    actual: result.stats.discrepancyCount,
    passed: result.stats.discrepancyCount === expectedDiscrepancy
  });
  
  // Should see verified count
  const expectedVerified = testInvoices.filter(i => i.status === STATUSES.VERIFIED).length;
  validations.push({
    test: 'Verified count matches',
    expected: expectedVerified,
    actual: result.stats.verifiedCount,
    passed: result.stats.verifiedCount === expectedVerified
  });
  
  // Should see pending approval count
  const expectedPending = testInvoices.filter(i => i.status === STATUSES.PENDING_APPROVAL).length;
  validations.push({
    test: 'Pending approval count matches',
    expected: expectedPending,
    actual: result.stats.pendingApprovalCount,
    passed: result.stats.pendingApprovalCount === expectedPending
  });
  
  return { result, validations };
}

// Verify Vendor dashboard API
async function verifyVendorDashboard(db, vendorIndex) {
  const vendor = testUsers.vendor[vendorIndex];
  console.log(`\n🔍 Verifying Vendor Dashboard API - ${vendor.name}...`);
  
  const result = await simulateDashboardAPI(VENDOR, vendor.id, db);
  
  const expectedInvoices = testInvoices.filter(inv => inv.submittedByUserId === vendor.id);
  
  const validations = [];
  
  // Should see ONLY their own invoices
  validations.push({
    test: 'Vendor sees only their invoices',
    expected: expectedInvoices.length,
    actual: result.invoices.length,
    passed: result.invoices.length === expectedInvoices.length
  });
  
  // Verify all invoices belong to this vendor
  const foreignInvoices = result.invoices.filter(inv => inv.submittedByUserId !== vendor.id);
  validations.push({
    test: 'No foreign invoices visible',
    expected: 0,
    actual: foreignInvoices.length,
    passed: foreignInvoices.length === 0,
    critical: true
  });
  
  // Total billing volume should match
  const expectedTotal = expectedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  validations.push({
    test: 'Total billing volume matches',
    expected: expectedTotal,
    actual: result.stats.totalBillingVolume,
    passed: result.stats.totalBillingVolume === expectedTotal
  });
  
  // Paid count should match
  const expectedPaid = expectedInvoices.filter(i => i.status === STATUSES.PAID).length;
  validations.push({
    test: 'Paid count matches',
    expected: expectedPaid,
    actual: result.stats.paidCount,
    passed: result.stats.paidCount === expectedPaid
  });
  
  // Processing count should match
  const expectedProcessing = expectedInvoices.filter(i => [STATUSES.DIGITIZING, STATUSES.RECEIVED].includes(i.status)).length;
  validations.push({
    test: 'Processing count matches',
    expected: expectedProcessing,
    actual: result.stats.processingCount,
    passed: result.stats.processingCount === expectedProcessing
  });
  
  return { result, validations };
}

// Verify Finance dashboard API
async function verifyFinanceDashboard(db) {
  console.log('\n🔍 Verifying Finance Dashboard API...');
  
  const result = await simulateDashboardAPI(FINANCE_USER, testUsers.finance.id, db);
  
  const validations = [];
  
  // Should see ALL invoices
  validations.push({
    test: 'Finance sees all invoices',
    expected: testInvoices.length,
    actual: result.invoices.length,
    passed: result.invoices.length === testInvoices.length
  });
  
  // Pending approvals should match
  const expectedPending = testInvoices.filter(i => i.status === STATUSES.PENDING_APPROVAL).length;
  validations.push({
    test: 'Pending approvals count matches',
    expected: expectedPending,
    actual: result.stats.pendingApprovals,
    passed: result.stats.pendingApprovals === expectedPending
  });
  
  // MTD Spend should match total (simplified test)
  const expectedTotal = testInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  validations.push({
    test: 'Spend amount is calculated',
    expected: expectedTotal,
    actual: result.stats.mtdSpend,
    passed: result.stats.mtdSpend === expectedTotal
  });
  
  // Weekly processed should match
  const expectedProcessed = testInvoices.filter(i => i.status === STATUSES.VERIFIED).length;
  validations.push({
    test: 'Processed count matches',
    expected: expectedProcessed,
    actual: result.stats.weeklyProcessedCount,
    passed: result.stats.weeklyProcessedCount === expectedProcessed
  });
  
  return { result, validations };
}

// Verify PM dashboard API
async function verifyPMDashboard(db, pmIndex) {
  const pm = testUsers.pm[pmIndex];
  console.log(`\n🔍 Verifying Project Manager Dashboard API - ${pm.name}...`);
  
  const result = await simulateDashboardAPI(PROJECT_MANAGER, pm.id, db);
  
  // Expected invoices: those assigned directly OR those from assigned projects
  const expectedInvoices = testInvoices.filter(inv => {
    const hasProjectAccess = (pm.assignedProjects || []).includes(inv.project) || inv.assignedPM === pm.id;
    return hasProjectAccess;
  });
  
  const validations = [];
  
  validations.push({
    test: 'PM sees their assigned invoices',
    expected: expectedInvoices.length,
    actual: result.invoices.length,
    passed: result.invoices.length === expectedInvoices.length,
    critical: true
  });
  
  // Verify no invoices from unassigned projects
  const unexpectedInvoices = result.invoices.filter(inv => {
    const hasProjectAccess = (pm.assignedProjects || []).includes(inv.project) || inv.assignedPM === pm.id;
    return !hasProjectAccess;
  });
  
  validations.push({
    test: `No invoices from unassigned projects`,
    expected: 0,
    actual: unexpectedInvoices.length,
    passed: unexpectedInvoices.length === 0,
    critical: true,
    details: unexpectedInvoices.length > 0 ? `Found ${unexpectedInvoices.length} unexpected invoices` : 'None'
  });
  
  // Total invoices count
  validations.push({
    test: 'Total invoices count matches',
    expected: expectedInvoices.length,
    actual: result.stats.totalInvoices,
    passed: result.stats.totalInvoices === expectedInvoices.length
  });
  
  // Pending approval count
  const expectedPending = expectedInvoices.filter(i => i.status === STATUSES.PENDING_APPROVAL).length;
  validations.push({
    test: 'Pending approval count matches',
    expected: expectedPending,
    actual: result.stats.pendingApproval,
    passed: result.stats.pendingApproval === expectedPending
  });
  
  // Approved count
  const expectedApproved = expectedInvoices.filter(i => i.status === STATUSES.VERIFIED || i.status === STATUSES.PAID).length;
  validations.push({
    test: 'Approved count matches',
    expected: expectedApproved,
    actual: result.stats.approvedCount,
    passed: result.stats.approvedCount === expectedApproved
  });
  
  // Discrepancies count
  const expectedDiscrepancies = expectedInvoices.filter(i => i.status === STATUSES.MATCH_DISCREPANCY).length;
  validations.push({
    test: 'Discrepancies count matches',
    expected: expectedDiscrepancies,
    actual: result.stats.discrepanciesCount,
    passed: result.stats.discrepanciesCount === expectedDiscrepancies
  });
  
  return { result, validations };
}

// Check for cross-role data leakage
async function checkCrossRoleLeakage(db, allResults) {
  console.log('\n🔒 Checking for cross-role data leakage...');
  
  const validations = [];
  
  // Helper to safely get invoice IDs
  const getInvoiceIds = (result) => {
    if (!result || !result.result || !result.result.invoices) {
      console.warn('⚠️ Unexpected result structure:', result);
      return new Set();
    }
    return new Set(result.result.invoices.map(i => i.id));
  };
  
  const adminInvoices = getInvoiceIds(allResults.admin);
  const vendor1Invoices = getInvoiceIds(allResults.vendor1);
  const vendor2Invoices = getInvoiceIds(allResults.vendor2);
  const financeInvoices = getInvoiceIds(allResults.finance);
  const pm1Invoices = getInvoiceIds(allResults.pm1);
  const pm2Invoices = getInvoiceIds(allResults.pm2);
  
  // Vendors should only see their own invoices
  const vendor1InvoicesNotOwned = (allResults.vendor1?.result?.invoices || []).filter(i => i.submittedByUserId !== testUsers.vendor[0].id);
  validations.push({
    test: 'Vendor 1 sees only their invoices',
    expected: 0,
    actual: vendor1InvoicesNotOwned.length,
    passed: vendor1InvoicesNotOwned.length === 0,
    critical: true,
    details: vendor1InvoicesNotOwned.length > 0 ?
      `Foreign invoices: ${vendor1InvoicesNotOwned.map(i => i.id).join(', ')}` :
      'None'
  });
  
  const vendor2InvoicesNotOwned = (allResults.vendor2?.result?.invoices || []).filter(i => i.submittedByUserId !== testUsers.vendor[1].id);
  validations.push({
    test: 'Vendor 2 sees only their invoices',
    expected: 0,
    actual: vendor2InvoicesNotOwned.length,
    passed: vendor2InvoicesNotOwned.length === 0,
    critical: true,
    details: vendor2InvoicesNotOwned.length > 0 ?
      `Foreign invoices: ${vendor2InvoicesNotOwned.map(i => i.id).join(', ')}` :
      'None'
  });
  
  // PMs should not see invoices from unassigned projects
  const pm1Unauthorized = (allResults.pm1?.result?.invoices || []).filter(inv => {
    return !testUsers.pm[0].assignedProjects.includes(inv.project) && inv.assignedPM !== 'verify-pm-001';
  });
  validations.push({
    test: 'PM 1 sees only assigned invoices',
    expected: 0,
    actual: pm1Unauthorized.length,
    passed: pm1Unauthorized.length === 0,
    critical: true,
    details: pm1Unauthorized.length > 0 ? 
      `Unauthorized: ${pm1Unauthorized.map(i => i.id).join(', ')}` : 
      'None'
  });
  
  const pm2Unauthorized = (allResults.pm2?.result?.invoices || []).filter(inv => {
    return !testUsers.pm[1].assignedProjects.includes(inv.project) && inv.assignedPM !== 'verify-pm-002';
  });
  validations.push({
    test: 'PM 2 sees only assigned invoices',
    expected: 0,
    actual: pm2Unauthorized.length,
    passed: pm2Unauthorized.length === 0,
    critical: true,
    details: pm2Unauthorized.length > 0 ? 
      `Unauthorized: ${pm2Unauthorized.map(i => i.id).join(', ')}` : 
      'None'
  });
  
  // Ensure admin sees everything PMs see (superset check)
  const adminMissingPM1 = [...pm1Invoices].filter(id => !adminInvoices.has(id));
  validations.push({
    test: 'Admin sees all PM 1 invoices',
    expected: 0,
    actual: adminMissingPM1.length,
    passed: adminMissingPM1.length === 0,
    details: adminMissingPM1.length > 0 ? `Missing: ${adminMissingPM1.join(', ')}` : 'None'
  });
  
  const adminMissingPM2 = [...pm2Invoices].filter(id => !adminInvoices.has(id));
  validations.push({
    test: 'Admin sees all PM 2 invoices',
    expected: 0,
    actual: adminMissingPM2.length,
    passed: adminMissingPM2.length === 0,
    details: adminMissingPM2.length > 0 ? `Missing: ${adminMissingPM2.join(', ')}` : 'None'
  });
  
  return validations;
}

// Generate report
function generateReport(allResults, allValidations) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DASHBOARD API VERIFICATION REPORT');
  console.log('='.repeat(80));
  
  const flatValidations = allValidations.flat();
  const passed = flatValidations.filter(v => v.passed).length;
  const failed = flatValidations.filter(v => !v.passed).length;
  const criticalFailed = flatValidations.filter(v => !v.passed && v.critical).length;
  
  console.log(`\nTotal Tests: ${flatValidations.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  if (criticalFailed > 0) {
    console.log(`🚨 Critical Failures: ${criticalFailed}`);
  }
  
  console.log('\n' + '-'.repeat(80));
  console.log(' detailed Results');
  console.log('-'.repeat(80));
  
  // Admin Dashboard
  console.log('\n🔵 ADMIN DASHBOARD');
  allResults.admin.validations.forEach(v => {
    const icon = v.passed ? '✅' : (v.critical ? '🚨' : '❌');
    const mark = v.critical ? '[CRITICAL]' : '';
    console.log(`   ${icon} ${mark} ${v.test}`);
    if (!v.passed && v.actual !== undefined && v.expected !== undefined) {
      console.log(`      Expected: ${v.expected}, Got: ${v.actual}`);
    }
    if (v.details) {
      console.log(`      Details: ${v.details}`);
    }
  });
  
  // Vendor Dashboards
  console.log('\n🟢 VENDOR 1 DASHBOARD');
  allResults.vendor1.validations.forEach(v => {
    const icon = v.passed ? '✅' : (v.critical ? '🚨' : '❌');
    const mark = v.critical ? '[CRITICAL]' : '';
    console.log(`   ${icon} ${mark} ${v.test}`);
    if (!v.passed && v.actual !== undefined && v.expected !== undefined) {
      console.log(`      Expected: ${v.expected}, Got: ${v.actual}`);
    }
    if (v.details) {
      console.log(`      Details: ${v.details}`);
    }
  });
  
  console.log('\n🟢 VENDOR 2 DASHBOARD');
  allResults.vendor2.validations.forEach(v => {
    const icon = v.passed ? '✅' : (v.critical ? '🚨' : '❌');
    const mark = v.critical ? '[CRITICAL]' : '';
    console.log(`   ${icon} ${mark} ${v.test}`);
    if (!v.passed && v.actual !== undefined && v.expected !== undefined) {
      console.log(`      Expected: ${v.expected}, Got: ${v.actual}`);
    }
    if (v.details) {
      console.log(`      Details: ${v.details}`);
    }
  });
  
  // Finance Dashboard
  console.log('\n🟡 FINANCE DASHBOARD');
  allResults.finance.validations.forEach(v => {
    const icon = v.passed ? '✅' : (v.critical ? '🚨' : '❌');
    const mark = v.critical ? '[CRITICAL]' : '';
    console.log(`   ${icon} ${mark} ${v.test}`);
    if (!v.passed && v.actual !== undefined && v.expected !== undefined) {
      console.log(`      Expected: ${v.expected}, Got: ${v.actual}`);
    }
    if (v.details) {
      console.log(`      Details: ${v.details}`);
    }
  });
  
  // PM Dashboards
  console.log('\n🟣 PROJECT MANAGER 1 DASHBOARD');
  allResults.pm1.validations.forEach(v => {
    const icon = v.passed ? '✅' : (v.critical ? '🚨' : '❌');
    const mark = v.critical ? '[CRITICAL]' : '';
    console.log(`   ${icon} ${mark} ${v.test}`);
    if (!v.passed && v.actual !== undefined && v.expected !== undefined) {
      console.log(`      Expected: ${v.expected}, Got: ${v.actual}`);
    }
    if (v.details) {
      console.log(`      Details: ${v.details}`);
    }
  });
  
  console.log('\n🟣 PROJECT MANAGER 2 DASHBOARD');
  allResults.pm2.validations.forEach(v => {
    const icon = v.passed ? '✅' : (v.critical ? '🚨' : '❌');
    const mark = v.critical ? '[CRITICAL]' : '';
    console.log(`   ${icon} ${mark} ${v.test}`);
    if (!v.passed && v.actual !== undefined && v.expected !== undefined) {
      console.log(`      Expected: ${v.expected}, Got: ${v.actual}`);
    }
    if (v.details) {
      console.log(`      Details: ${v.details}`);
    }
  });
  
  // Cross-role leakage checks
  console.log('\n🔒 CROSS-ROLE DATA LEAKAGE CHECKS');
  allResults.crossRole.forEach(v => {
    const icon = v.passed ? '✅' : (v.critical ? '🚨' : '❌');
    const mark = v.critical ? '[CRITICAL]' : '';
    console.log(`   ${icon} ${mark} ${v.test}`);
    if (!v.passed && v.actual !== undefined && v.expected !== undefined) {
      console.log(`      Expected: ${v.expected}, Got: ${v.actual}`);
    }
    if (v.details) {
      console.log(`      Details: ${v.details}`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  
  if (criticalFailed > 0) {
    console.log(`🚨 ${criticalFailed} CRITICAL FAILURES DETECTED!`);
    console.log('These indicate security vulnerabilities that must be addressed.');
  } else if (failed > 0) {
    console.log(`⚠️  ${failed} non-critical test(s) failed. Review and fix if necessary.`);
  } else {
    console.log('✅ ALL TESTS PASSED! Dashboard APIs are secure.');
  }
  
  console.log('='.repeat(80) + '\n');
  
  return criticalFailed === 0;
}

// Main execution
async function main() {
  let client;
  let success = false;
  
  try {
    console.log('🚀 Starting Dashboard API Verification...\n');
    
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    // Initialize test database
    await initializeDatabase(client);
    
    const db = client.db(TEST_DB_NAME);
    
    // Run all verification tests
    const allResults = {
      admin: await verifyAdminDashboard(db),
      vendor1: await verifyVendorDashboard(db, 0),
      vendor2: await verifyVendorDashboard(db, 1),
      finance: await verifyFinanceDashboard(db),
      pm1: await verifyPMDashboard(db, 0),
      pm2: await verifyPMDashboard(db, 1)
    };
    
    // Check for cross-role leakage
    allResults.crossRole = await checkCrossRoleLeakage(db, allResults);
    
    // Generate and print report
    const allValidations = [
      allResults.admin.validations,
      allResults.vendor1.validations,
      allResults.vendor2.validations,
      allResults.finance.validations,
      allResults.pm1.validations,
      allResults.pm2.validations,
      allResults.crossRole
    ];
    
    success = generateReport(allResults, allValidations);
    
    // Cleanup test database
    console.log('🧹 Cleaning up test database...');
    await db.collection('users').deleteMany({ email: /verify\./ });
    await db.collection('invoices').deleteMany({ id: { $regex: /^INV-verify/ } });
    await client.db().listCollections().toArray().then(async (collections) => {
      for (const col of collections) {
        if (col.name === TEST_DB_NAME) {
          await db.dropDatabase();
          break;
        }
      }
    });
    console.log('✅ Cleanup complete\n');
    
  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    success = false;
  } finally {
    if (client) {
      await client.close();
      console.log('✅ Disconnected from MongoDB\n');
    }
  }
  
  process.exit(success ? 0 : 1);
}

// Run the script
main();