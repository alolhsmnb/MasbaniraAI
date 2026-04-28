import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('images')

    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: 'No images provided' }, { status: 400 })
    }

    const setting = await db.siteSetting.findUnique({ where: { key: 'imgbb_api_key' } })
    const apiKey = setting?.value

    if (!apiKey) {
      console.error('[Upload] ImgBB API key not configured')
      return NextResponse.json(
        { success: false, error: 'Image upload is not configured. Please contact an administrator.' },
        { status: 500 }
      )
    }

    const urls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File

      if (file.size > 10 * 1024 * 1024) {
        console.warn(`[Upload] File ${i} too large (${file.size} bytes), skipping`)
        continue
      }

      const imageBuffer = Buffer.from(await file.arrayBuffer())
      const base64 = imageBuffer.toString('base64')

      const imgbbForm = new FormData()
      imgbbForm.append('key', apiKey)
      imgbbForm.append('image', base64)
      imgbbForm.append('expiration', '600')

      try {
        const res = await fetch('https://api.imgbb.com/1/upload', {
          method: 'POST',
          body: imgbbForm,
        })

        const data = await res.json()

        if (data.success && data.data?.display_url) {
          urls.push(data.data.display_url)
        } else {
          console.error(`[Upload] ImgBB error for file ${i}:`, data.error?.message || JSON.stringify(data).substring(0, 200))
        }
      } catch (uploadErr) {
        console.error(`[Upload] Failed to upload file ${i}:`, uploadErr)
      }
    }

    if (urls.length === 0) {
      return NextResponse.json({ success: false, error: 'All uploads failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { urls },
      images: urls,
    })
  } catch (error) {
    console.error('[Upload] Error:', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}
