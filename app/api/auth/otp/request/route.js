import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Users from '@/models/Users';
import { Otp } from '@/models/Internal';
import { sendStatusNotification, sendEmailAndLog } from '@/lib/notifications';

/**
 * POST /api/auth/otp/request
 * Request a One-Time Password (OTP) for login
 */
export async function POST(request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        await connectToDatabase();

        // Check if user exists (Strict RBAC: Only registered users can login)
        const user = await Users.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            // User does not exist - do not send OTP
            return NextResponse.json({
                error: 'No account found with this email address. Please sign up first.'
            }, { status: 404 });
        }

        if (!user.isActive) {
            return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Expiry: 10 minutes from now
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Save OTP to DB (upsert: update if exists for this email)
        await Otp.findOneAndUpdate(
            { email: user.email },
            { otp, expiresAt },
            { upsert: true, new: true }
        );

        // Send OTP via Email using the shared notification logic
        const status = await sendEmailAndLog({
            recipient: user.email,
            subject: `Your Login OTP for InvoiceFlow`,
            message: `Your One-Time Password (OTP) for InvoiceFlow is:\n\n${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
            notificationType: 'OTP'
        });

        if (status === 'FAILED') {
            return NextResponse.json({
                error: 'Failed to deliver OTP email. Please contact support if this persists.'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'OTP sent successfully'
        });

    } catch (error) {
        console.error('OTP Request Error:', error);
        return NextResponse.json({ error: 'Failed to generate OTP' }, { status: 500 });
    }
}
