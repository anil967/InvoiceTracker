import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import { getSession } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { ROLES } from '@/constants/roles';

/**
 * GET /api/vendor/invoices - Get vendor's submitted invoices with status tracking
 */
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const roleCheck = requireRole([ROLES.VENDOR])(session.user);
        if (!roleCheck.allowed) {
            return NextResponse.json({ error: roleCheck.reason }, { status: 403 });
        }

        await connectToDatabase();

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        // Get invoices submitted by this vendor
        let query = { submittedByUserId: session.user.id };
        if (status) query.status = status;

        const invoices = await Invoice.find(query)
            .sort({ created_at: -1 })
            .select({
                id: 1,
                invoiceNumber: 1,
                amount: 1,
                date: 1,
                status: 1,
                project: 1,
                assignedPM: 1,
                pmApproval: 1,
                financeApproval: 1,
                hilReview: 1,
                created_at: 1,
                updated_at: 1
            });

        // Calculate status summary
        const allInvoices = await Invoice.find({ submittedByUserId: session.user.id });
        const statusCounts = {
            total: allInvoices.length,
            pending: allInvoices.filter(i => i.status === 'Pending').length,
            pmApproved: allInvoices.filter(i => i.pmApproval?.status === 'APPROVED').length,
            approved: allInvoices.filter(i => i.status === 'Approved').length,
            rejected: allInvoices.filter(i => i.status === 'Rejected').length,
            infoRequested: allInvoices.filter(i => i.status === 'Info Requested').length
        };

        // Map invoices to include detailed status for vendor view
        const invoicesWithStatus = invoices.map(inv => {
            const stages = [
                { name: 'Submitted', completed: true, date: inv.created_at },
                {
                    name: 'PM Review', completed: inv.pmApproval?.status === 'APPROVED',
                    status: inv.pmApproval?.status || 'PENDING'
                },
                {
                    name: 'HIL Verification', completed: inv.hilReview?.status === 'REVIEWED',
                    status: inv.hilReview?.status || 'PENDING'
                },
                {
                    name: 'Finance Approval', completed: inv.financeApproval?.status === 'APPROVED',
                    status: inv.financeApproval?.status || 'PENDING'
                },
                { name: 'Payment', completed: inv.status === 'Paid', status: inv.status === 'Paid' ? 'COMPLETE' : 'PENDING' }
            ];

            return {
                ...inv.toObject(),
                stages,
                currentStage: stages.findIndex(s => !s.completed),
                progressPercent: Math.round((stages.filter(s => s.completed).length / stages.length) * 100)
            };
        });

        return NextResponse.json({
            invoices: invoicesWithStatus,
            statusCounts
        });
    } catch (error) {
        console.error('Error fetching vendor invoices:', error);
        return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }
}
