import { NextRequest, NextResponse } from 'next/server'
import { getAllActiveApiKeys } from '@/lib/kie-api'

/**
 * Debug endpoint to check raw MJ API response for a taskId
 * Usage: GET /api/debug/mj?taskId=xxx
 */
export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get('taskId')

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
  }

  const allKeys = await getAllActiveApiKeys()

  const results: Record<string, unknown>[] = []

  for (const apiKey of allKeys) {
    try {
      const url = `https://api.kie.ai/api/v1/mj/record-info?taskId=${encodeURIComponent(taskId)}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey.key}`,
        },
      })

      const text = await response.text()
      let json
      try {
        json = JSON.parse(text)
      } catch {
        json = { raw: text }
      }

      results.push({
        keyName: apiKey.name || apiKey.id.substring(0, 8),
        httpStatus: response.status,
        successFlag: json?.data?.successFlag,
        successFlagType: typeof json?.data?.successFlag,
        resultInfoJsonType: typeof json?.data?.resultInfoJson,
        resultInfoJson: json?.data?.resultInfoJson,
        completeTime: json?.data?.completeTime,
        errorCode: json?.data?.errorCode,
        errorMessage: json?.data?.errorMessage,
        fullResponse: json,
      })
    } catch (err) {
      results.push({
        keyName: apiKey.name || apiKey.id.substring(0, 8),
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    taskId,
    keysTested: results.length,
    results,
  })
}
