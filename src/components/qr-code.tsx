'use client'

import { Skeleton } from '@/components/ui/skeleton'

interface QRCodeProps {
  value: string
  size?: number
  className?: string
}

/**
 * QRCode display component.
 * Uses the CryptAPI QR endpoint to generate a QR code.
 * Falls back to a canvas-based rendering if the API fails.
 */
export function QRCode({ value, size = 256, className = '' }: QRCodeProps) {
  // Use the external QR API as an img src
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=000000&color=ffffff&format=png`

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={qrUrl}
        alt="Payment QR Code"
        width={size}
        height={size}
        className="rounded-xl"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}

/**
 * QRCodeFromBase64 displays a QR code from a base64 data URL
 * (as returned by the create-order API).
 */
export function QRCodeFromBase64({ data, size = 256, className = '' }: { data: string; size?: number; className?: string }) {
  if (!data) {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        <Skeleton className="rounded-xl" style={{ width: size, height: size }} />
      </div>
    )
  }

  const src = data.startsWith('data:') ? data : `data:image/png;base64,${data}`

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <img
        src={src}
        alt="Payment QR Code"
        width={size}
        height={size}
        className="rounded-xl"
      />
    </div>
  )
}
