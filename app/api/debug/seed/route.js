import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ROLES } from '@/constants/roles';
import bcrypt from 'bcryptjs';

export async function GET() {
    try {
        console.log("[Seed] Starting ERP Data Seed...");

        // 0. Seed Users
        // 0. Seed Users with Consistent Password
        const salt = await bcrypt.genSalt(10);
        const defaultPasswordHash = await bcrypt.hash('Password123!', salt); // Common password for all demo users

        const users = [
            // 1. Admin
            {
                id: 'u-admin-01',
                name: 'System Admin',
                email: 'admin@invoiceflow.com',
                passwordHash: defaultPasswordHash,
                role: ROLES.ADMIN,
                assignedProjects: [],
                vendorId: null
            },
            // 2. Project Manager (with assigned projects)
            {
                id: 'u-pm-01',
                name: 'Project Manager',
                email: 'pm@invoiceflow.com',
                passwordHash: defaultPasswordHash,
                role: ROLES.PROJECT_MANAGER,
                assignedProjects: ['Project Alpha', 'Cloud Migration'], // Critical for testing RBAC
                vendorId: null
            },
            // 3. Finance User (Operational)
            {
                id: 'u-finance-01',
                name: 'Finance User',
                email: 'financeuser@invoiceflow.com', // Updated for consistency
                passwordHash: defaultPasswordHash,
                role: ROLES.FINANCE_USER,
                assignedProjects: [],
                vendorId: null
            },
            // 4. Vendor (Linked to Acme Solutions)
            {
                id: 'u-vendor-01',
                name: 'Acme Solutions', // Must match Vendor Name for current simple mapping
                email: 'vendor@acme.com',
                passwordHash: defaultPasswordHash,
                role: ROLES.VENDOR,
                assignedProjects: [],
                vendorId: 'v-001'
            },
        ];

        // Ensure unique creation/update by email
        for (const user of users) {
            const existing = await db.getUserByEmail(user.email);
            if (!existing) {
                await db.createUser(user);
                console.log(`[Seed] Created user: ${user.email} (${user.role})`);
            } else {
                // Update existing user to ensure role/projects are current
                await db.createUser(user);
                console.log(`[Seed] Updated user: ${user.email} (${user.role})`);
            }
        }


        // 1. Seed Vendors
        const vendors = [
            { id: 'v-001', name: 'Acme solutions', email: 'billing@acme.com', phone: '123-456-7890', address: '123 Acme St, NY', tax_id: 'TX-1001' },
            { id: 'v-002', name: 'Global Tech Inc', email: 'invoices@globaltech.com', phone: '987-654-3210', address: '456 Tech Park, CA', tax_id: 'TX-2002' },
            { id: 'v-003', name: 'Office Depot', email: 'supply@officedepot.com', phone: '555-0199', address: '789 Supply Ave, FL', tax_id: 'TX-3003' }
        ];

        // 1. Seed Vendors (Sequential to avoid vendorCode conflicts)
        for (const v of vendors) {
            try {
                await db.createVendor(v);
            } catch (e) {
                console.log(`[Seed] Vendor ${v.name} already exists, skipping.`);
            }
        }

        // 2. Seed Purchase Orders
        const pos = [
            {
                id: 'po-001',
                poNumber: 'PO-2026-001',
                vendorId: 'v-001',
                date: '2026-02-01',
                totalAmount: 50000.00,
                currency: 'INR',
                status: 'OPEN',
                items: [
                    { description: 'Cloud infrastructure - Feb', quantity: 1, unitPrice: 45000.00, amount: 45000.00, glAccount: 'GL-5000' },
                    { description: 'Setup Fee', quantity: 1, unitPrice: 5000.00, amount: 5000.00, glAccount: 'GL-5001' }
                ]
            },
            {
                id: 'po-002',
                poNumber: 'PO-2026-002',
                vendorId: 'v-002',
                date: '2026-01-15',
                totalAmount: 125000.00,
                currency: 'INR',
                status: 'OPEN',
                items: [
                    { description: 'Software Development Services', quantity: 100, unitPrice: 1250.00, amount: 125000.00, glAccount: 'GL-6000' }
                ]
            }
        ];

        for (const po of pos) {
            try {
                await db.createPurchaseOrder(po);
            } catch (e) {
                console.log(`[Seed] PO ${po.poNumber} already exists, skipping.`);
            }
        }

        // 3. Seed Ringi Annexures
        const annexures = [
            {
                id: 'ax-001',
                annexureNumber: 'RINGI-2026-A1',
                poId: 'po-001',
                originalAmount: 60000.00,
                approvedAmount: 55000.00,
                description: 'Digital Transformation Project - Phase 1',
                status: 'APPROVED'
            }
        ];

        for (const ax of annexures) {
            try {
                await db.createAnnexure(ax);
            } catch (e) {
                console.log(`[Seed] Annexure ${ax.annexureNumber} already exists, skipping.`);
            }
        }

        // 4. Seed sample invoices (so they appear in dashboard, vendor portal, etc.)
        const sampleInvoices = [
            {
                id: 'INV-SEED001',
                vendorName: 'Acme Solutions',
                submittedByUserId: 'u-vendor-01',
                originalName: 'Invoice_Acme_Jan2026.pdf',
                receivedAt: new Date().toISOString(),
                invoiceNumber: 'INV-2026-001',
                date: '2026-02-01',
                amount: 50000,
                status: 'VERIFIED',
                project: 'Project Alpha',
                poNumber: 'PO-2026-001',
                matching: { isMatched: true }
            },
            {
                id: 'INV-SEED002',
                vendorName: 'Global Tech Inc',
                submittedByUserId: 'u-finance-01',
                originalName: 'Invoice_GlobalTech_Feb.pdf',
                receivedAt: new Date().toISOString(),
                invoiceNumber: 'INV-2026-002',
                date: '2026-02-05',
                amount: 125000,
                status: 'PENDING_APPROVAL',
                project: 'Cloud Migration',
                poNumber: 'PO-2026-002',
                matching: { isMatched: true }
            },
            {
                id: 'INV-SEED003',
                vendorName: 'Acme Solutions',
                submittedByUserId: 'u-vendor-01',
                originalName: 'Invoice_Acme_Feb2026.pdf',
                receivedAt: new Date().toISOString(),
                invoiceNumber: 'INV-2026-003',
                date: '2026-02-07',
                amount: 25000,
                status: 'RECEIVED',
                project: 'Project Alpha',
                poNumber: 'PO-2026-001',
                matching: { isMatched: false }
            }
        ];
        for (const inv of sampleInvoices) {
            await db.saveInvoice(inv.id, inv);
        }

        console.log("[Seed] ERP Data Seed Completed.");

        // Return credentials for easy access
        const credentials = users.map(u => ({
            role: u.role,
            email: u.email,
            password: 'Password123!', // Default password
            name: u.name
        }));

        return NextResponse.json({
            message: 'ERP seed successful',
            counts: {
                users: users.length,
                vendors: vendors.length,
                pos: pos.length,
                annexures: annexures.length,
                invoices: sampleInvoices.length
            },
            credentials: credentials,
            defaultPassword: 'Password123!',
            note: 'All users share the same default password. Change in production!'
        });

    } catch (error) {
        console.error("[Seed] ERP Seed error:", error);
        return NextResponse.json({ error: 'Failed to seed ERP data' }, { status: 500 });
    }
}
