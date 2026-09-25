import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Ensure Prisma connects on startup
// This helps prevent "Engine is not yet connected" errors
let connectionPromise: Promise<void> | null = null;

async function ensureConnection() {
    if (connectionPromise) {
        return connectionPromise;
    }

    connectionPromise = (async () => {
        try {
            // Try to connect
            await prisma.$connect();
            console.log('Prisma client connected successfully');
        } catch (error) {
            console.error('Failed to connect Prisma client:', error);
            connectionPromise = null; // Reset to allow retry
            throw error;
        }
    })();

    return connectionPromise;
}

// Connect immediately on module load
ensureConnection().catch((error) => {
    console.error('Initial Prisma connection attempt failed:', error);
    connectionPromise = null; // Allow retry on first query
});

// Handle graceful shutdown
if (typeof process !== 'undefined') {
    const shutdown = async () => {
        try {
            await prisma.$disconnect();
        } catch (error) {
            console.error('Error disconnecting Prisma:', error);
        }
    };

    process.on('beforeExit', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}