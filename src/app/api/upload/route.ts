import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'

const IMGBB_API_URL = 'https://api.imgbb.com/1/upload'
const EXPIRATION_SECONDS = 600 // 10 minutes auto-delete
const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32MB (ImgBB limit)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILES = 8

// Fallback key in case DB is not accessible or key not set
const FALLBACK_IMGBB_KEY = 'b638c35d946a3d94b9484d20ab726698'

/**
 * Upload images to ImgBB. Images auto-delete after 10 minutes.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)

    const formData = await request.formData()
    const files = formData.getAll('images')

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      )
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_FILES} files allowed per upload` },
        { status: 400 }
      )
    }

    // Get ImgBB API key: try DB first, then fallback
    let apiKey = FALLBACK_IMGBB_KEY
    try {
      const imgbbSetting = await db.siteSetting.findUnique({
        where: { key: 'imgbb_api_key' },
      })
      if (imgbbSetting?.value) {
        apiKey = imgbbSetting.value
      }
    } catch {
      // DB not accessible - use fallback key
    }

    const urls: string[] = []

    for (const file of files) {
      if (!(file instanceof File)) continue

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF` },
          { status: 400 }
        )
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: `File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 32MB` },
          { status: 400 }
        )
      }

      // Upload to ImgBB using base64 encoding (most reliable)
      const bytes = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString('base64')

      const imgbbForm = new FormData()
      imgbbForm.append('key', apiKey)
      imgbbForm.append('image', base64)
      imgbbForm.append('expiration', String(EXPIRATION_SECONDS))

      const response = await fetch(IMGBB_API_URL, {
        method: 'POST',
        body: imgbbForm,
      })

      const data = await response.json()

      if (data.success && data.data?.url) {
        urls.push(data.data.url)
      } else {
        const errorMsg = data.error?.message || data.status_txt || 'ImgBB upload failed'
        console.error('[ImgBB] Upload failed:', JSON.stringify(data))
        return NextResponse.json(
          { success: false, error: `Image upload failed: ${errorMsg}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      data: { urls },
    })
  } catch (error) {
    console.error('Upload error:', error)

    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }
}
