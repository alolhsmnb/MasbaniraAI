import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { requireAdmin, AuthError } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const fileName = formData.get('fileName') as string | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Sanitize filename - prevent directory traversal
    const safeName = (fileName || file.name).replace(/[^a-zA-Z0-9._-]/g, '_')
    
    // Only allow specific extensions
    const allowedExt = ['.html', '.txt', '.xml', '.json']
    const ext = path.extname(safeName).toLowerCase()
    if (!allowedExt.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `Only ${allowedExt.join(', ')} files are allowed` },
        { status: 400 }
      )
    }

    // Limit file size to 100KB
    if (file.size > 100 * 1024) {
      return NextResponse.json({ success: false, error: 'File size must be under 100KB' }, { status: 400 })
    }

    const publicDir = path.join(process.cwd(), 'public')
    if (!existsSync(publicDir)) {
      await mkdir(publicDir, { recursive: true })
    }

    const filePath = path.join(publicDir, safeName)
    const bytes = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    return NextResponse.json({
      success: true,
      data: {
        fileName: safeName,
        url: `/${safeName}`,
        size: file.size,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    console.error('Upload verify file error:', error)
    return NextResponse.json({ success: false, error: 'Failed to upload file' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('file')

    if (fileName) {
      // Delete specific file
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '')
      const filePath = path.join(process.cwd(), 'public', safeName)
      const { unlink } = await import('fs/promises')
      try {
        await unlink(filePath)
        return NextResponse.json({ success: true, data: { message: 'File deleted' } })
      } catch {
        return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 })
      }
    }

    // List uploaded verification files (common ones)
    const { readdirSync } = await import('fs')
    const publicDir = path.join(process.cwd(), 'public')
    const verifyFiles = ['ads.txt', 'ads.html', 'googleads.html', 'bing-siteauth.xml', 'robots.txt']
    const found: string[] = []

    for (const f of verifyFiles) {
      if (existsSync(path.join(publicDir, f))) {
        found.push(f)
      }
    }

    // Also check for any .html verification files
    try {
      const files = readdirSync(publicDir)
      for (const f of files) {
        if ((f.startsWith('google') || f.startsWith('verify') || f.startsWith('bing')) && 
            (f.endsWith('.html') || f.endsWith('.txt'))) {
          if (!found.includes(f)) found.push(f)
        }
      }
    } catch {
      // public dir might not exist
    }

    return NextResponse.json({ success: true, data: found })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    console.error('List verify files error:', error)
    return NextResponse.json({ success: false, error: 'Failed to list files' }, { status: 500 })
  }
}
