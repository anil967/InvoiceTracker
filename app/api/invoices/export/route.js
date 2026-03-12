import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const invoices = await db.getInvoices();

        // Define CSV headers
        const headers = ["ID", "Original Name", "Vendor", "Amount", "Status", "Received At", "Processed At", "Cost Center", "Account Code"];

        // Map data to rows
        const rows = invoices.map(inv => [
            inv.id,
            inv.originalName || "N/A",
            inv.vendorName || "Unextracted",
            inv.totalAmount || inv.amount || 0,
            inv.status,
            inv.receivedAt,
            inv.processedAt || "N/A",
            inv.costCenter || "N/A",
            inv.accountCode || "N/A"
        ]);

        // Combine into CSV string
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename=invoice_audit_log.csv'
            },
        });

    } catch (error) {
        console.error('Export error:', error);
        return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 });
    }
}
