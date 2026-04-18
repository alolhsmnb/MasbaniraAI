import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'

const IMGBB_API_URL = 'https://api.imgbb.com/1/upload'
const EXPIRATION_SECONDS = 600 // 10 minutes auto-delete
const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32MB (ImgBB limit)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILES = 8
const UPLOADS_DIR = join(process.cwd(), 'uploads')

/**
 * Upload images - tries ImgBB first, falls back to local storage.
 * Images auto-delete after 10 minutes when using ImgBB.
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

    // Get ImgBB API key from database settings
    let imgbbApiKey: string | null = null
    try {
      const imgbbSetting = await db.siteSetting.findUnique({
        where: { key: 'imgbb_api_key' },
      })
      imgbbApiKey = imgbbSetting?.value || null
    } catch (dbErr) {
      console.warn('[Upload] Could not fetch ImgBB key from DB, using local fallback:', dbErr)
    }

    // Ensure local uploads directory exists (as fallback)
    await mkdir(UPLOADS_DIR, { recursive: true })

    const urls: string[] = []

    for (const file of files) {
      if (!(file instanceof File)) continue

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            success: false,
            error: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF`,
          },
          { status: 400 }
        )
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: `File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: 32MB`,
          },
          { status: 400 }
        )
      }

      let uploadedUrl: string | null = null

      // Try ImgBB upload first
      if (imgbbApiKey) {
        try {
          const imgbbForm = new FormData()
          imgbbForm.append('key', imgbbApiKey)
          imgbbForm.append('image', file)
          imgbbForm.append('expiration', String(EXPIRATION_SECONDS))

          const response = await fetch(
            `${IMGBB_API_URL}?key=${encodeURIComponent(imgbbApiKey)}&expiration=${EXPIRATION_SECONDS}`,
            {
              method: 'POST',
              body: imgbbForm,
            }
          )

          const data = await response.json()

          if (data.success && data.data?.url) {
            uploadedUrl = data.data.url
            console.log(`[ImgBB] Uploaded: ${file.name} -> ${uploadedUrl}`)
          } else {
            console.error('[ImgBB] Upload failed:', JSON.stringify(data))
          }
        } catch (imgbbErr) {
          console.error('[ImgBB] Upload error, falling back to local:', imgbbErr)
        }
      }

      // Fallback: save to local uploads directory
      if (!uploadedUrl) {
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif']
        const originalExt = file.name.split('.').pop()?.toLowerCase() || 'png'
        const ext = allowedExtensions.includes(originalExt) ? originalExt : 'png'
        const filename = `${randomUUID()}.${ext}`
        const filepath = join(UPLOADS_DIR, filename)

        const bytes = await file.arrayBuffer()
        await writeFile(filepath, Buffer.from(bytes))

        const baseUrl = process.env.NEXTAUTH_URL || ''
        uploadedUrl = `${baseUrl}/api/files/${filename}`
        console.log(`[Local] Uploaded: ${file.name} -> ${uploadedUrl}`)
      }

      urls.push(uploadedUrl)
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
