import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Build DATABASE_URL with connection pool parameters for serverless (Vercel).
 * 
 * In serverless, each function can create a new connection. Without pgbouncer,
 * Supabase free plan limits to 15 concurrent connections.
 * 
 * Add these params to DATABASE_URL in Vercel env vars:
 *   ?connection_limit=3&pool_timeout=10
 * 
 * Or use the connection pooler URL (pgbouncer) from Supabase dashboard:
 *   Connection Pooling → Transaction Mode → URI
 */
function getDbUrl(): string {
  const url = process.env.DATABASE_URL || ''
  // Already has pool params, use as-is
  if (url.includes('connection_limit') || url.includes('pgbouncer') || url.startsWith('file:')) {
    return url
  }
  // For Supabase/PostgreSQL URLs, inject safe pool limits
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}connection_limit=5&pool_timeout=15&connect_timeout=10`
  }
  return url
}

// In serverless (Vercel), each function invocation can create a new connection.
// We reuse the PrismaClient instance via globalThis to minimize connections.
const db = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: getDbUrl(),
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

export { db }
