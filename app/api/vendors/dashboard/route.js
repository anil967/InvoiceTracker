import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server-auth';
import { db } from '@/lib/db';
import { ROLES } from '@/constants/roles';
import connectToDatabase from '@/lib/mongodb';

import { DocumentUpload } from '@/models/Internal';
import { RateCard } from '@/models/Admin';

// Helper to log to DB for production debugging
const logToDb = async (level, message, details = {}) => {
    try {
        console.log(`[${level}] ${message}`, details); // Consoles for Vercel logs
        // Also save to a debug collection for persistence
        await connectToDatabase();
        if (db && db.createDebugLog) {
             await db.createDebugLog({ level, message, details, timestamp: new Date() });
        } else {
             // Fallback if db helper helper missing, direct insert if possible or just console
             const mongoose = await import('mongoose');
             const DebugLog = mongoose.models.DebugLog || mongoose.model('DebugLog', new mongoose.Schema({
                 level: String,
                 message: String,
                 details: Object,
                 timestamp: Date
             }));
             await DebugLog.create({ level, message, details, timestamp: new Date() });
        }
    } catch (e) {
        console.error('Failed to log to DB:', e);
    }
};

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        // Get current user from session
        const user = await getCurrentUser();

        if (!user) {
            await logToDb('WARN', 'Unauthorized access attempt in /api/vendors/dashboard');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        await logToDb('INFO', `Vendor dashboard access`, { userId: user.id, email: user.email, role: user.role });

        // Verify user has Vendor role or is an Admin
        const role = user.role;
        if (role !== ROLES.VENDOR && role !== ROLES.ADMIN) {
            return NextResponse.json({ error: 'Forbidden: Vendor or Admin access required' }, { status: 403 });
        }

        // Fetch invoices with RBAC filtering (Vendor only sees their own invoices via submittedByUserId)
        const invoices = await db.getInvoices(user);
        await logToDb('INFO', `Fetched invoices for vendor`, { count: invoices.length, userId: user.id });

        // Fetch additional documents for all invoices
        await connectToDatabase();
        const invoiceIds = invoices.map(inv => inv.id);
        const additionalDocs = invoiceIds.length > 0
            ? await DocumentUpload.find({ invoiceId: { $in: invoiceIds } }).lean()
            : [];

        // Build a map of invoiceId -> documents
        const docsMap = {};
        for (const doc of additionalDocs) {
            if (!docsMap[doc.invoiceId]) docsMap[doc.invoiceId] = [];
            docsMap[doc.invoiceId].push({
                documentId: doc.id,
                type: doc.type,
                fileName: doc.fileName,
            });
        }

        // Enrich invoices with additional documents
        const enrichedInvoices = invoices.map(inv => ({
            ...inv,
            additionalDocs: docsMap[inv.id] || [],
        }));

        // Calculate vendor-specific statistics
        const stats = {
            totalInvoices: invoices.length,
            paidCount: invoices.filter(inv => inv.status === 'PAID').length,
            processingCount: invoices.filter(inv => ['DIGITIZING', 'RECEIVED'].includes(inv.status)).length,
            totalBillingVolume: invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
        };

        // Fetch active rate cards for the vendor directly from DB (avoid self-fetch)
        let rateCards = [];
        try {
            if (user.vendorId) {
                const conditions = [
                    { vendorId: user.vendorId },
                    { status: 'ACTIVE' },
                    {
                        $or: [
                            { effectiveTo: null },
                            { effectiveTo: { $exists: false } },
                            { effectiveTo: { $gte: new Date() } }
                        ]
                    }
                ];
                rateCards = await RateCard.find({ $and: conditions }).sort({ projectId: -1, effectiveFrom: -1 }).lean();
            }
        } catch (rcError) {
            console.error('Failed to fetch rate cards directly:', rcError);
            await logToDb('ERROR', `Rate card fetch failed`, { error: rcError.message });
            // Don't crash dashboard if rate cards fail
        }

        // Return stats, filtered invoices, and rate cards
        return NextResponse.json({
            stats,
            invoices: enrichedInvoices,
            rateCards
        });

    } catch (error) {
        console.error('Vendor dashboard API error:', error);
        await logToDb('ERROR', `Vendor dashboard API crash: ${error.message}`, { stack: error.stack });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
