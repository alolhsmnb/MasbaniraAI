import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Compress an image file on the client side using Canvas API.
 * Ensures the resulting file is within Vercel's serverless function body limit (4.5MB).
 *
 * @param file - The image file to compress
 * @param maxSizeMB - Maximum output file size in MB (default: 3.5MB for safety margin)
 * @param maxDimension - Maximum width/height in pixels (default: 4096)
 * @returns A compressed File object
 */
export async function compressImage(
  file: File,
  maxSizeMB = 3.5,
  maxDimension = 4096
): Promise<File> {
  const maxSizeBytes = maxSizeMB * 1024 * 1024

  // Skip compression if file is already small enough
  if (file.size <= maxSizeBytes) {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // Scale down dimensions if they exceed maxDimension
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Determine output format
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'

      // Try progressively lower quality until under max size
      let quality = 0.85
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'))
              return
            }

            if (blob.size <= maxSizeBytes || quality <= 0.1) {
              const ext = outputType === 'image/png' ? 'png' : 'jpg'
              const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '') + '_compressed.' + ext, {
                type: outputType,
                lastModified: Date.now(),
              })
              resolve(compressed)
            } else {
              // Reduce quality by 10% and try again
              quality -= 0.1
              // Also scale down dimensions by 10%
              const newRatio = 0.9
              width = Math.round(width * newRatio)
              height = Math.round(height * newRatio)
              canvas.width = width
              canvas.height = height
              ctx.drawImage(img, 0, 0, width, height)
              tryCompress()
            }
          },
          outputType,
          quality
        )
      }

      tryCompress()
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}
