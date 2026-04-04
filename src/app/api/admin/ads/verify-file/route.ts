import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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
    const ext = '.' + safeName.split('.').pop()?.toLowerCase()
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

    // Read file content
    const bytes = await file.arrayBuffer()
    const content = Buffer.from(bytes).toString('utf-8')

    // Upsert to database
    await db.verificationFile.upsert({
      where: { fileName: safeName },
      update: { content, size: file.size },
      create: { fileName: safeName, content, size: file.size },
    })

    return NextResponse.json({
      success: true,
      data: {
        fileName: safeName,
        url: `/api/public/verify/${safeName}`,
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

    // Delete specific file from DB
    if (fileName && action === 'delete') {
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '')
      try {
        await db.verificationFile.delete({ where: { fileName: safeName } })
        return NextResponse.json({ success: true, data: { message: 'File deleted' } })
      } catch {
        return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 })
      }
    }

    // View file content from DB
    if (fileName && action === 'view') {
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '')
      try {
        const file = await db.verificationFile.findUnique({ where: { fileName: safeName } })
        if (!file) {
          return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 })
        }
        return NextResponse.json({
          success: true,
          data: {
            fileName: file.fileName,
            content: file.content,
            size: file.size,
            modifiedAt: file.updatedAt.toISOString(),
          },
        })
      } catch {
        return NextResponse.json({ success: false, error: 'Failed to read file' }, { status: 500 })
      }
    }

    // List all verification files from DB
    const files = await db.verificationFile.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: files.map((f) => ({
        fileName: f.fileName,
        size: f.size,
        modifiedAt: f.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode })
    }
    console.error('List verify files error:', error)
    return NextResponse.json({ success: false, error: 'Failed to list files' }, { status: 500 })
  }
}
