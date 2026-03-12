import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server-auth';
import { sendPendingApprovalReminders } from '@/lib/notifications';
import { ROLES } from '@/constants/roles';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/send-reminders
 * Sends reminder emails for invoices awaiting PM or Finance approval.
 * Callable by Admin or by cron (optional: CRON_SECRET in env).
 */
export async function POST(request) {
    try {
        const user = await getCurrentUser();
        const cronSecret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret');
        const isCron = process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;

        if (!isCron && (!user || user.role !== ROLES.ADMIN)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const results = await sendPendingApprovalReminders();

        return NextResponse.json({
            message: 'Reminders sent',
            ...results
        });
    } catch (error) {
        console.error('Send reminders error:', error);
        return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 });
    }
}
