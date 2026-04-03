import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret-key')
const COOKIE_NAME = 'session'
const EXPIRES_IN_DAYS = 7

export interface SessionUser {
  userId: string
  email: string
  name: string | null
  avatar: string | null
  role: string
}

export interface SessionPayload extends SessionUser {
  exp: number
}

export async function createSession(user: {
  id: string
  email: string
  name: string | null
  avatar: string | null
  role: string
}): Promise<string> {
  const now = Date.now()
  const exp = now + EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000

  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    role: user.role,
  } as Omit<SessionPayload, 'exp'>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${EXPIRES_IN_DAYS}d`)
    .setIssuedAt()
    .sign(secret)

  // Don't use Secure flag - the app runs behind a proxy chain where HTTPS may not be
  // end-to-end, causing Secure cookies to be rejected by the browser
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${EXPIRES_IN_DAYS * 24 * 60 * 60}`
}

export async function getSession(request?: Request): Promise<SessionUser | null> {
  try {
    let cookieHeader: string | undefined

    if (request) {
      cookieHeader = request.headers.get('cookie') || undefined
    } else {
      const cookieStore = await cookies()
      const token = cookieStore.get(COOKIE_NAME)?.value
      if (!token) return null
      cookieHeader = `${COOKIE_NAME}=${token}`
    }

    if (!cookieHeader) return null

    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
    if (!match) return null

    const token = match[1]
    const { payload } = await jwtVerify(token, secret)

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: (payload.name as string) || null,
      avatar: (payload.avatar as string) || null,
      role: (payload.role as string) || 'USER',
    }
  } catch {
    return null
  }
}

export function destroySession(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export async function requireAuth(request: Request): Promise<SessionUser> {
  const session = await getSession(request)
  if (!session) {
    throw new AuthError('Unauthorized', 401)
  }
  return session
}

export async function requireAdmin(request: Request): Promise<SessionUser> {
  const session = await requireAuth(request)
  if (session.role !== 'ADMIN') {
    throw new AuthError('Forbidden: Admin access required', 403)
  }
  return session
}

export class AuthError extends Error {
  statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.name = 'AuthError'
  }
}
