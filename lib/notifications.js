/**
 * SendGrid email notifications. All sent emails are logged to the Notification collection.
 *
 * Required for sending: SENDGRID_API_KEY, FROM_EMAIL (verified in SendGrid).
 * Optional: COMPANY_NAME (sender name), FINANCE_TEAM_EMAIL, PM_APPROVER_EMAIL, CRON_SECRET.
 */
import connectToDatabase from '@/lib/mongodb';
import { db } from '@/lib/db';
import { Vendor } from '@/models/Admin';
import Invoice from '@/models/Invoice';

async function getVendorEmail(invoice) {
    if (invoice.submittedByUserId) {
        const user = await db.getUserById(invoice.submittedByUserId);
        if (user?.email) return user.email;
    }
    await connectToDatabase();
    const vendor = await Vendor.findOne({ name: invoice.vendorName }).exec();
    return vendor?.email || null;
}

/**
 * Send email via SendGrid and log to notifications collection.
 * @returns {'SENT'|'FAILED'}
 */
export async function sendEmailAndLog({ recipient, subject, message, relatedEntityId, notificationType }) {
    const apiKey = process.env.SENDGRID_API_KEY;
    let status = 'FAILED';

    if (apiKey) {
        try {
            const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    personalizations: [{ to: [{ email: recipient }] }],
                    from: {
                        email: process.env.FROM_EMAIL || "system@invoicetracker.internal",
                        name: process.env.COMPANY_NAME || "Invoice Tracker"
                    },
                    subject,
                    content: [{ type: "text/plain", value: message }]
                })
            });
            if (response.ok) {
                status = 'SENT';
                console.log(`[Notification] Email sent to ${recipient}`);
            } else {
                const err = await response.json().catch(() => ({}));
                console.error("[Notification] SendGrid Error:", JSON.stringify(err));
            }
        } catch (error) {
            console.error("[Notification] Failed to send email:", error);
        }
    } else {
        if (!sendEmailAndLog._warned) {
            sendEmailAndLog._warned = true;
            console.warn("[Notification] SENDGRID_API_KEY not set. Emails skipped. Set in .env.local to enable.");
        }
    }

    try {
        await db.createNotification({
            recipient_email: recipient,
            subject,
            message,
            status,
            related_entity_id: relatedEntityId || null,
            notification_type: notificationType || null
        });
    } catch (e) {
        console.error("Failed to log notification to DB", e);
    }

    return status;
}

/**
 * Send status-driven notifications (invoice receipt, rejection, payment, pending approval).
 * All notifications are logged to the notifications collection.
 */
export const sendStatusNotification = async (invoice, nextStatus) => {
    console.log(`[Notification] Preparing alert for Invoice ${invoice.id} (${nextStatus})`);

    const companyName = process.env.COMPANY_NAME || "Invoice Tracker";
    let recipient = process.env.FINANCE_TEAM_EMAIL || "finance-team@example.com";
    let subject = `Invoice ${invoice.id} Update: ${nextStatus}`;
    let message = `Invoice ${invoice.id} from ${invoice.vendorName} is now ${nextStatus}.`;

    if (nextStatus === 'RECEIVED') {
        const vendorEmail = await getVendorEmail(invoice);
        if (vendorEmail) recipient = vendorEmail;
        subject = `Invoice received: ${invoice.id}`;
        message = `${companyName}\n\nYour invoice ${invoice.id} ("${invoice.originalName || 'Invoice'}") has been received and is being processed. You will be notified of any updates.`;
    } else if (nextStatus === 'PENDING_APPROVAL') {
        recipient = process.env.PM_APPROVER_EMAIL || "pm-approver@example.com";
        message = `${companyName}\n\n` + message + " Action required: Please review and approve for payment.";
    } else if (nextStatus === 'REJECTED') {
        const vendorEmail = await getVendorEmail(invoice);
        if (vendorEmail) recipient = vendorEmail;
        else console.warn(`[Notification] Vendor email not found for: ${invoice.vendorName}`);
        message = `${companyName}\n\n` + message + " Please check the vendor portal for details.";
    } else if (nextStatus === 'PAID') {
        const vendorEmail = await getVendorEmail(invoice);
        if (vendorEmail) recipient = vendorEmail;
        else console.warn(`[Notification] Vendor email not found for: ${invoice.vendorName}`);
        message = `${companyName}\n\n` + message + " Payment released. Expected arrival within 3-5 business days.";
    } else if (nextStatus === 'AWAITING_INFO') {
        const vendorEmail = await getVendorEmail(invoice);
        if (vendorEmail) recipient = vendorEmail;
        message = `${companyName}\n\nAdditional information is requested for invoice ${invoice.id}. Please log in to the vendor portal for details.`;
    } else {
        message = `${companyName}\n\n` + message;
    }

    return sendEmailAndLog({
        recipient,
        subject,
        message,
        relatedEntityId: invoice.id,
        notificationType: nextStatus
    });
};

/**
 * Send reminders for invoices awaiting PM or Finance approval.
 * Call from cron or POST /api/notifications/send-reminders.
 */
export const sendPendingApprovalReminders = async () => {
    await connectToDatabase();
    const pending = await Invoice.find({
        status: { $in: ['VERIFIED', 'PENDING_APPROVAL'] }
    }).limit(50);

    const results = { sent: 0, skipped: 0 };
    const reminderEmail = process.env.PM_APPROVER_EMAIL || process.env.FINANCE_TEAM_EMAIL || "finance-team@example.com";
    const companyName = process.env.COMPANY_NAME || "Invoice Tracker";

    for (const inv of pending) {
        const doc = inv.toObject ? inv.toObject() : inv;

        if (doc.status === 'VERIFIED') {
            const status = await sendEmailAndLog({
                recipient: reminderEmail,
                subject: `Reminder: Invoice ${doc.id} awaiting PM approval`,
                message: `${companyName}\n\nInvoice ${doc.id} from ${doc.vendorName} is verified and awaiting your approval.`,
                relatedEntityId: doc.id,
                notificationType: 'REMINDER'
            });
            if (status === 'SENT') results.sent++;
            else results.skipped++;
        } else if (doc.status === 'PENDING_APPROVAL') {
            const status = await sendEmailAndLog({
                recipient: process.env.FINANCE_TEAM_EMAIL || reminderEmail,
                subject: `Reminder: Invoice ${doc.id} awaiting Finance approval`,
                message: `${companyName}\n\nInvoice ${doc.id} has been PM-approved and is awaiting Finance release.`,
                relatedEntityId: doc.id,
                notificationType: 'REMINDER'
            });
            if (status === 'SENT') results.sent++;
            else results.skipped++;
        }
    }

    return results;
};
