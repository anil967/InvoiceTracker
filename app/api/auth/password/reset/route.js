import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Users from '@/models/Users';
import { Otp } from '@/models/Internal';
import bcrypt from 'bcryptjs';

/**
 * POST /api/auth/password/reset
 * Reset user password after OTP verification
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { email, otp, newPassword } = body;

        if (!email || !otp || !newPassword) {
            return NextResponse.json(
                { error: 'Email, OTP, and new password are required' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters long' },
                { status: 400 }
            );
        }

        await connectToDatabase();

        // 1. Verify OTP
        const validOtp = await Otp.findOne({
            email: email.trim().toLowerCase(),
            otp: otp.trim()
        });

        if (!validOtp) {
            return NextResponse.json(
                { error: 'Invalid or expired OTP' },
                { status: 401 }
            );
        }

        // 2. Find user
        const user = await Users.findOne({ email: email.trim().toLowerCase() });
        if (!user) {
            return NextResponse.json({ error: 'User account not found' }, { status: 404 });
        }

        // 3. Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // 4. Update user password
        user.password = hashedPassword;
        await user.save();

        // 5. Delete the used OTP
        await Otp.deleteOne({ _id: validOtp._id });

        return NextResponse.json({
            success: true,
            message: 'Password reset successful'
        });

    } catch (error) {
        console.error('Password Reset Error:', error);
        return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
    }
}
