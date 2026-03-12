import { NextResponse } from 'next/server';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.89';

export async function GET() {
    return NextResponse.json({
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        status: 'healthy'
    }, {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
    });
}
