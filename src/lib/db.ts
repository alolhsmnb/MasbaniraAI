import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In serverless (Vercel), each function invocation can create a new connection.
// We reuse the PrismaClient instance via globalThis to minimize connections.
// Connection pool params are set via DATABASE_URL connection string.
const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export { db }
