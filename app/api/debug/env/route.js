import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
    const mongodbUri = process.env.MONGODB_URI;
    const envKeys = Object.keys(process.env);

    let connectionState = 'unknown';
    let errorMessage = null;

    try {
        connectionState = mongoose.connection.readyState;
        // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    } catch (e) {
        errorMessage = e.message;
    }

    return NextResponse.json({
        hasMongodbUri: !!mongodbUri,
        mongodbUriPrefix: mongodbUri ? mongodbUri.substring(0, 20) + '...' : 'NONE',
        connectionState,
        mongooseVersion: mongoose.version,
        envKeysCount: envKeys.length,
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        error: errorMessage
    });
}
