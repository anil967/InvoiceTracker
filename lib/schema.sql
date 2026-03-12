-- lib/schema.sql
-- =============================================================================
-- LEGACY / REFERENCE: PostgreSQL schema only. This file is NOT used at runtime.
-- The application uses MongoDB. Data layer: lib/db.js with Mongoose models in
-- models/ (User, Invoice, Vendor, PurchaseOrder, Annexure, AuditTrail, etc.).
-- Use this SQL only for reference or for a future Postgres-based deployment.
-- =============================================================================

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    vendor_name TEXT NOT NULL,
    invoice_number TEXT,
    date TEXT,
    amount DECIMAL(15, 2),
    status TEXT NOT NULL,
    category TEXT,
    due_date TEXT,
    cost_center TEXT,
    account_code TEXT,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_trail table
CREATE TABLE IF NOT EXISTS audit_trail (
    id SERIAL PRIMARY KEY,
    invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    username TEXT,
    action TEXT,
    details TEXT
);

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    tax_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    po_number TEXT UNIQUE NOT NULL,
    vendor_id TEXT REFERENCES vendors(id),
    date TEXT,
    total_amount DECIMAL(15, 2),
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'OPEN', -- OPEN, CLOSED, CANCELLED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create po_items table (Line Items for POs)
CREATE TABLE IF NOT EXISTS po_items (
    id SERIAL PRIMARY KEY,
    po_id TEXT REFERENCES purchase_orders(id) ON DELETE CASCADE,
    description TEXT,
    quantity DECIMAL(10, 2),
    unit_price DECIMAL(15, 2),
    amount DECIMAL(15, 2),
    gl_account TEXT
);

-- Create annexures table (Ringi)
CREATE TABLE IF NOT EXISTS annexures (
    id TEXT PRIMARY KEY,
    annexure_number TEXT UNIQUE NOT NULL,
    po_id TEXT REFERENCES purchase_orders(id),
    original_amount DECIMAL(15, 2),
    approved_amount DECIMAL(15, 2), -- The limit that can be invoiced
    description TEXT,
    status TEXT DEFAULT 'APPROVED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_email TEXT,
    subject TEXT,
    message TEXT,
    status TEXT DEFAULT 'SENT', -- SENT, FAILED
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    related_entity_id TEXT -- e.g., Invoice ID
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_name);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id);

