import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Always create a fresh PrismaClient in development to pick up schema changes
const db = new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export { db }
