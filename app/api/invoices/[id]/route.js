import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/server-auth';
import { performThreeWayMatch } from '@/lib/services/matching';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
    const { id } = await params;
    const user = await getCurrentUser();
    const invoice = await db.getInvoice(id, user);

    if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json(invoice);
}

export async function PUT(request, { params }) {
    const { id } = await params;
    const updates = await request.json();

    // Capture request metadata for audit trail early
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Get current user for audit
    const user = await getCurrentUser();

    const invoice = await db.getInvoice(id);
    if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Capture previous status for audit
    const previousStatus = invoice.status;

    let finalUpdates = { ...updates };

    // Phase 3: Trigger Matching if data is being verified or updated
    // If status is moved to VERIFIED (meaning data entry is done), we run matching.
    if (updates.status === 'VERIFIED' || finalUpdates.poNumber) {
        console.log(`[API] Triggering Matching for ${id}`);

        // Merge existing invoice data with updates to ensure we have latest fields
        const invoiceDataForMatch = {
            ...invoice,
            ...updates
        };

        const matchingResults = await performThreeWayMatch(invoiceDataForMatch);

        finalUpdates.matching = matchingResults;

        // Logic: If matched, keep verified/matched status. If discrepancies, set status.
        if (matchingResults.isMatched) {
            finalUpdates.status = 'VERIFIED'; // Ready for approval
        } else {
            finalUpdates.status = 'MATCH_DISCREPANCY';
        }
    }

    // Create comprehensive audit trail entry if status changed
    let auditTrailEntry = null;
    if (previousStatus !== finalUpdates.status) {
        auditTrailEntry = {
            action: 'UPDATE_AND_MATCH',
            actor: user?.name || user?.email || 'System',
            actorId: user?.id || null,
            actorRole: user ? await (await import('@/constants/roles')).getNormalizedRole(user) : 'SYSTEM',
            timestamp: new Date().toISOString(),
            previousStatus: previousStatus,
            newStatus: finalUpdates.status,
            notes: finalUpdates.matching?.isMatched
                ? 'Invoice updated and matched successfully'
                : `Invoice updated with matching discrepancies: ${finalUpdates.matching?.discrepancies?.join(', ') || 'Unknown'}`,
            ipAddress: ipAddress,
            userAgent: userAgent
        };
    }

    const updatedInvoice = await db.saveInvoice(id, {
        ...finalUpdates,
        auditTrailEntry: auditTrailEntry,
        updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
        message: 'Invoice updated successfully',
        invoice: updatedInvoice
    });
}
