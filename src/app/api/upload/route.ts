import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { requireAuth, AuthError } from '@/lib/auth'

const UPLOADS_DIR = join(process.cwd(), 'uploads')
const MAX_FILE_SIZE = 30 * 1024 * 1024 // 30MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request)
    const formData = await request.formData()
    const files = formData.getAll('images')

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      )
    }

    if (files.length > 8) {
      return NextResponse.json(
        { success: false, error: 'Maximum 8 images allowed' },
        { status: 400 }
      )
    }

    // Ensure uploads directory exists
    await mkdir(UPLOADS_DIR, { recursive: true })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const urls: string[] = []

    for (const file of files) {
      if (!(file instanceof File)) continue

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: `File type ${file.type} not allowed. Use JPEG, PNG, or WebP.` },
          { status: 400 }
        )
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} exceeds 30MB limit` },
          { status: 400 }
        )
      }

      // Generate unique filename
      const ext = file.name.split('.').pop() || 'png'
      const filename = `${randomUUID()}.${ext}`
      const filepath = join(UPLOADS_DIR, filename)

      // Write file
      const bytes = await file.arrayBuffer()
      await writeFile(filepath, Buffer.from(bytes))

      // Return URL
      urls.push(`${baseUrl}/api/files/${filename}`)
    }

    return NextResponse.json({
      success: true,
      data: { urls },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }
    console.error('Upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
