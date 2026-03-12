import { NextResponse } from 'next/server';
import { logout_session } from '@/lib/auth';

export async function POST() {
    try {
        await logout_session();
        return NextResponse.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
