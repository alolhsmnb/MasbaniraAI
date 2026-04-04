import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, unlink, stat, readFile } from 'fs/promises'
import { existsSync, readdirSync } from 'fs'
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
    const action = searchParams.get('action')

    // Delete specific file
    if (fileName && action === 'delete') {
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '')
      const filePath = path.join(process.cwd(), 'public', safeName)
      
      // Security: only allow known verification file patterns
      const allowedPatterns = ['ads.txt', 'ads.html', 'google', 'verify', 'bing', 'robots.txt', 'sitemap']
      const isAllowed = allowedPatterns.some(p => safeName.toLowerCase().includes(p.toLowerCase()))
      if (!isAllowed) {
        return NextResponse.json({ success: false, error: 'Cannot delete this file' }, { status: 403 })
      }

      try {
        await unlink(filePath)
        return NextResponse.json({ success: true, data: { message: 'File deleted' } })
      } catch {
        return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 })
      }
    }

    // View file content
    if (fileName && action === 'view') {
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '')
      const filePath = path.join(process.cwd(), 'public', safeName)
      
      try {
        const content = await readFile(filePath, 'utf-8')
        const stats = await stat(filePath)
        return NextResponse.json({
          success: true,
          data: {
            fileName: safeName,
            content,
            size: stats.size,
            modifiedAt: stats.mtime.toISOString(),
          },
        })
      } catch {
        return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 })
      }
    }

    // List all verification files with metadata
    const publicDir = path.join(process.cwd(), 'public')
    const verifyPatterns = ['ads.txt', 'ads.html', 'googleads.html', 'bing-siteauth.xml', 'robots.txt']
    const found: { fileName: string; size: number; modifiedAt: string }[] = []

    // Check known patterns first
    for (const f of verifyPatterns) {
      const fp = path.join(publicDir, f)
      if (existsSync(fp)) {
        try {
          const stats = await stat(fp)
          found.push({
            fileName: f,
            size: stats.size,
            modifiedAt: stats.mtime.toISOString(),
          })
        } catch {
          found.push({ fileName: f, size: 0, modifiedAt: '' })
        }
      }
    }

    // Check for any verification-like files in public dir
    try {
      const files = readdirSync(publicDir)
      for (const f of files) {
        if (
          (f.startsWith('google') || f.startsWith('verify') || f.startsWith('bing') || f.startsWith('ads')) &&
          (f.endsWith('.html') || f.endsWith('.txt') || f.endsWith('.xml'))
        ) {
          if (!found.find(ef => ef.fileName === f)) {
            try {
              const stats = await stat(path.join(publicDir, f))
              found.push({
                fileName: f,
                size: stats.size,
                modifiedAt: stats.mtime.toISOString(),
              })
            } catch {
              found.push({ fileName: f, size: 0, modifiedAt: '' })
            }
          }
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
