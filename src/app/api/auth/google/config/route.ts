import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { success: false, error: 'Google OAuth is not configured.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, clientId })
}
