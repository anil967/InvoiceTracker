import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';

/**
 * GET /api/finance/hil-review - Get invoices pending HIL review (Finance User only)
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.ADMIN, ROLES.FINANCE_USER])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        // Get all invoices for admin/finance and filter by HIL status
        const allInvoices = await db.getInvoices(session.user);

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'PENDING';

        // Filter invoices needing HIL review
        const invoices = allInvoices.filter(inv => {
            if (status === 'ALL') return true;
            return inv.hilReview?.status === status ||
                (!inv.hilReview?.status && status === 'PENDING');
        });

        // Sort by low confidence first, then by date
        invoices.sort((a, b) => {
            const confA = a.hilReview?.confidence ?? 100;
            const confB = b.hilReview?.confidence ?? 100;
            if (confA !== confB) return confA - confB; // Lower confidence first
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return NextResponse.json({
            invoices,
            stats: {
                pending: allInvoices.filter(i => !i.hilReview?.status || i.hilReview?.status === 'PENDING').length,
                reviewed: allInvoices.filter(i => i.hilReview?.status === 'REVIEWED').length,
                flagged: allInvoices.filter(i => i.hilReview?.status === 'FLAGGED').length
            }
        });
    } catch (error) {
        console.error('Error fetching HIL review queue:', error);
        return NextResponse.json({ error: 'Failed to fetch HIL review queue' }, { status: 500 });
    }
}

/**
 * POST /api/finance/hil-review - Submit HIL review for an invoice (Finance User only)
 */
export async function POST(request) {
    try {
        // Capture request metadata for audit trail early
        const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.FINANCE_USER])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        const body = await request.json();
        const { invoiceId, status, corrections, notes } = body;

        if (!invoiceId || !status) {
            return NextResponse.json(
                { error: 'Missing required fields: invoiceId, status' },
                { status: 400 }
            );
        }

        if (!['REVIEWED', 'FLAGGED'].includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status. Must be REVIEWED or FLAGGED' },
                { status: 400 }
            );
        }

        const invoice = await db.getInvoice(invoiceId);
        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        // Capture previous status for audit
        const previousStatus = invoice.status;

        // Update invoice with HIL review
        const hilReview = {
            status,
            reviewedBy: session.user.id,
            reviewedAt: new Date().toISOString(),
            corrections: corrections || null
        };

        // Apply corrections to invoice fields if provided
        const updateData = {
            hilReview,
            auditUsername: session.user.name || session.user.email,
            auditAction: 'HIL_REVIEW',
            auditDetails: `HIL review ${status}${notes ? `: ${notes}` : ''}`
        };

        // If corrections are provided, merge them into the invoice
        if (corrections) {
            if (corrections.invoiceNumber) updateData.invoiceNumber = corrections.invoiceNumber;
            if (corrections.amount) updateData.amount = parseFloat(corrections.amount);
            if (corrections.date) updateData.date = corrections.date;
            if (corrections.vendorName) updateData.vendorName = corrections.vendorName;
        }

        // Create comprehensive audit trail entry
        const auditTrailEntry = {
            action: 'HIL_REVIEW',
            actor: session.user.name || session.user.email,
            actorId: session.user.id,
            actorRole: 'FINANCE_USER',
            timestamp: new Date().toISOString(),
            previousStatus: previousStatus,
            newStatus: invoice.status, // HIL review doesn't change the main status
            notes: notes || `HIL review ${status}`,
            ipAddress: ipAddress,
            userAgent: userAgent
        };

        await db.saveInvoice(invoiceId, {
            ...updateData,
            auditTrailEntry: auditTrailEntry
        });

        return NextResponse.json({ success: true, message: `Invoice ${status.toLowerCase()}` });
    } catch (error) {
        console.error('Error submitting HIL review:', error);
        return NextResponse.json({ error: 'Failed to submit HIL review' }, { status: 500 });
    }
}
