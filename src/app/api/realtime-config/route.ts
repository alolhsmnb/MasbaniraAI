import { NextResponse } from 'next/server'

/**
 * Returns Supabase Realtime config for the client.
 * 
 * Both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are
 * public info (designed to be used in the browser) — NOT secrets.
 * The anon key is restricted by RLS policies.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return NextResponse.json(
      { success: false, error: 'Supabase Realtime not configured' },
      { status: 503 }
    )
  }

  return NextResponse.json({
    success: true,
    data: { url, key },
  })
}
