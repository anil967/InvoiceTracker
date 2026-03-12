import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export async function GET() {
    const startTime = Date.now();
    let steps = [];

    try {
        steps.push("Step 1: Starting check");

        // 1. Check raw mongoose state first
        steps.push(`Step 2: Initial mongoose readyState: ${mongoose.connection.readyState}`);

        // 2. Attempt db.testConnection
        steps.push("Step 3: Calling db.testConnection()");
        await db.testConnection();
        steps.push("Step 4: db.testConnection() succeeded");

        // 3. Re-check state
        steps.push(`Step 5: Final mongoose readyState: ${mongoose.connection.readyState}`);

        return NextResponse.json({
            status: 'success',
            steps,
            readyState: mongoose.connection.readyState,
            latency: Date.now() - startTime
        });
    } catch (error) {
        return NextResponse.json({
            status: 'error',
            steps,
            error: error.message,
            stack: error.stack,
            readyState: mongoose.connection.readyState,
            latency: Date.now() - startTime
        }, { status: 500 });
    }
}
