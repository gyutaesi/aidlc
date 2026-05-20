import { type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export function getTokenFromRequest(request: NextRequest): string | null {
  return (
    request.cookies.get('access_token')?.value ??
    request.headers.get('Authorization')?.replace('Bearer ', '') ??
    null
  )
}

export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('access_token')?.value ?? null
}
