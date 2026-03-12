import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const invoices = await db.getInvoices(user);

        // Calculate analytics based on filtered invoices
        const total = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        // ... rest of logic relies on invoices array which is now scoped!

        // 1. Cycle Time Calculation
        const paidInvoices = invoices.filter(inv => inv.status === 'PAID' && inv.paidAt && inv.ingestedAt);
        const avgCycleTime = paidInvoices.length > 0
            ? paidInvoices.reduce((acc, inv) => acc + (new Date(inv.paidAt) - new Date(inv.ingestedAt)), 0) / paidInvoices.length
            : 0;

        // 2. OCR Accuracy (Average confidence)
        const processedInvoices = invoices.filter(inv => inv.confidence !== undefined);
        const avgConfidence = processedInvoices.length > 0
            ? processedInvoices.reduce((acc, inv) => acc + (inv.confidence || 0), 0) / processedInvoices.length
            : 0.95; // Default target

        // 3. Status Distribution
        const statusCounts = invoices.reduce((acc, inv) => {
            acc[inv.status] = (acc[inv.status] || 0) + 1;
            return acc;
        }, {});

        // 4. Volume by Category
        const categoryVolume = invoices.reduce((acc, inv) => {
            const cat = inv.category || 'Uncategorized';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {});

        // 5. Volume Over Time (Last 5 Days)
        const volumeOverTime = [];
        for (let i = 4; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dateStr = d.toISOString().split('T')[0];

            const count = invoices.filter(inv => {
                const dateVal = inv.receivedAt || inv.created_at;
                if (!dateVal) return false;
                const dateStrVal = new Date(dateVal).toISOString().split('T')[0];
                return dateStrVal.startsWith(dateStr);
            }).length;

            volumeOverTime.push({ name: dayName, value: count });
        }

        return NextResponse.json({
            metrics: {
                avgCycleTimeHours: (avgCycleTime / (1000 * 60 * 60)).toFixed(1),
                ocrAccuracy: (avgConfidence * 100).toFixed(1),
                totalInvoices: invoices.length,
                paidInvoices: paidInvoices.length,
                savingsEstimated: (paidInvoices.length * 45).toFixed(0)
            },
            volumeOverTime,
            statusCounts,
            categoryVolume
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch analytics', details: error.message },
            { status: 500 }
        );
    }
}
