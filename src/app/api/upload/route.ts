import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Upload is available to all users (auth not required for upload itself)
    const session = await getSession(request)

    // Get ImgBB API key from database settings
    const imgbbSetting = await db.siteSetting.findUnique({
      where: { key: 'imgbb_api_key' },
    })

    if (!imgbbSetting?.value) {
      return NextResponse.json(
        { success: false, error: 'Image upload service is not configured' },
        { status: 503 }
      )
    }

    const imgbbApiKey = imgbbSetting.value

    // Parse multipart form data
    const formData = await request.formData()
    const images = formData.getAll('images')

    if (!images || images.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images provided' },
        { status: 400 }
      )
    }

    if (images.length > 8) {
      return NextResponse.json(
        { success: false, error: 'Maximum 8 images allowed' },
        { status: 400 }
      )
    }

    // Upload each image to ImgBB in parallel
    const uploadPromises = images.map(async (imageFile) => {
      if (!(imageFile instanceof File)) {
        return null
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(imageFile.type)) {
        throw new Error(`Invalid file type: ${imageFile.type}. Only JPEG, PNG, WebP, GIF are allowed.`)
      }

      // Validate file size (max 10MB after client compression)
      if (imageFile.size > 10 * 1024 * 1024) {
        throw new Error(`File too large: ${(imageFile.size / 1024 / 1024).toFixed(1)}MB. Maximum is 10MB.`)
      }

      const imgbbFormData = new FormData()
      imgbbFormData.append('image', imageFile)
      imgbbFormData.append('key', imgbbApiKey)

      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: imgbbFormData,
      })

      const data = await response.json()

      if (data.success && data.data?.url) {
        return {
          url: data.data.url,
          deleteUrl: data.data.delete_url || null,
          thumbUrl: data.data.thumb?.url || null,
        }
      }

      throw new Error(`ImgBB upload failed: ${data.error?.message || 'Unknown error'}`)
    })

    const results = await Promise.all(uploadPromises)
    const urls = results.filter((r): r is { url: string; deleteUrl: string | null; thumbUrl: string | null } => r !== null)

    if (urls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'All image uploads failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        urls: urls.map((r) => r.url),
        thumbs: urls.map((r) => r.thumbUrl),
      },
    })
  } catch (error) {
    console.error('[Upload] Error:', error)

    const message = error instanceof Error ? error.message : 'Failed to upload images'

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
