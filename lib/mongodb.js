import mongoose from 'mongoose';

/**
 * Global is used here to maintain cached connections across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 *
 * Multi-Database Architecture:
 * - usersDb: User accounts collection
 * - adminDb: Business & admin data (vendors, projects, purchaseorders, ratecards, delegations, audittrails, system_config)
 * - internalDb: Utility, operational & document data (otps, documentuploads, notifications, messages, annexures, invoices, debuglogs)
 */
let cached = {
    conn: null,
    promise: null,
    usersDb: null,
    adminDb: null,
    internalDb: null
};

if (!global.mongoose) {
    global.mongoose = cached;
} else {
    cached = global.mongoose;
}

async function connectToDatabase() {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        throw new Error(
            'Please define the MONGODB_URI environment variable inside .env.local'
        );
    }

    // Return cached base connection if available
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
            family: 4, // Use IPv4, which is often more stable with Atlas/DNS
            maxPoolSize: 10,
        };

        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
            return mongoose;
        });
    }

    try {
        if (cached.promise) {
            cached.conn = await cached.promise;
        } else {
            // Fallback if promise was somehow cleared but not current
            const opts = {
                bufferCommands: false,
                serverSelectionTimeoutMS: 15000,
                connectTimeoutMS: 15000,
                socketTimeoutMS: 45000,
                family: 4,
                maxPoolSize: 10,
            };
            cached.promise = mongoose.connect(MONGODB_URI, opts);
            cached.conn = await cached.promise;
        }
    } catch (e) {
        cached.promise = null;
        console.error("Mongoose connection error:", e.message);
        throw e;
    }

    return cached.conn;
}

/**
 * Get or create the users database connection
 * @returns {Mongoose} Mongoose connection to 'users' database
 */
function getUsersDb() {
    if (!cached.conn) {
        return null; // Connection not ready yet - callers should handle gracefully
    }

    if (!cached.usersDb) {
        cached.usersDb = cached.conn.connection.useDb('users');
    }
    return cached.usersDb;
}

/**
 * Get or create the admin database connection
 * @returns {Mongoose|null} Mongoose connection to 'admin_db' database, or null if not connected
 */
function getAdminDb() {
    if (!cached.conn) {
        return null;
    }

    if (!cached.adminDb) {
        cached.adminDb = cached.conn.connection.useDb('admin_db');
    }
    return cached.adminDb;
}

/**
 * Get or create the internal_data database connection
 * @returns {Mongoose|null} Mongoose connection to 'internal_data' database, or null if not connected
 */
function getInternalDb() {
    if (!cached.conn) {
        return null;
    }

    if (!cached.internalDb) {
        cached.internalDb = cached.conn.connection.useDb('internal_data');
    }
    return cached.internalDb;
}

export default connectToDatabase;
export { getUsersDb, getAdminDb, getInternalDb };
