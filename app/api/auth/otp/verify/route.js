import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Users from '@/models/Users';
import { Otp } from '@/models/Internal';
import { login } from '@/lib/auth';

/**
 * POST /api/auth/otp/verify
 * Verify OTP and log the user in
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { email, otp } = body;

        if (!email || !otp) {
            return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
        }

        await connectToDatabase();

        // Find the OTP
        const validOtp = await Otp.findOne({
            email: email.trim().toLowerCase(),
            otp: otp.trim()
        });

        if (!validOtp) {
            return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 });
        }

        // Check if user exists (Should exist correctly due to request flow)
        const user = await Users.findOne({ email: email.trim().toLowerCase() });

        if (!user) {
            return NextResponse.json({ error: 'User account not found' }, { status: 404 });
        }

        if (!user.isActive) {
            return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
        }

        // Login successful: Generate session
        // We reuse the 'login' function from lib/auth which sets the cookie

        // Generate session with normalized role
        const { getNormalizedRole: normalize } = await import('@/constants/roles');
        const normalizedRole = normalize({ role: user.role });

        const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: normalizedRole,
            vendorId: user.vendorId, // Include vendorId for role-based logic
            isActive: user.isActive !== false
        };

        // Log successful login for observability
        // Log successful login for observability
        // console.log(`[OTP Verify] Login successful for user: ${email}, role: ${normalizedRole}, id: ${user.id}`);

        await login(sessionUser);

        // Delete the used OTP to prevent replay attacks
        await Otp.deleteOne({ _id: validOtp._id });

        // Log session created and user data being returned
        // console.log(`[OTP Verify] Session created, returning user data:`, JSON.stringify(sessionUser));

        return NextResponse.json({
            success: true,
            user: sessionUser // Return user data for frontend context
        });

    } catch (error) {
        console.error('OTP Verification Error:', error);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}
