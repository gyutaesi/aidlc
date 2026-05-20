import { cookies } from 'next/headers'
import { authService } from '@/lib/services/auth.service'
import { collectionService } from '@/lib/services/collection.service'
import { CollectionsClient } from './collections-client'

export const dynamic = 'force-dynamic'

export default async function CollectionsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  if (!token) return null

  const user = await authService.getUserFromToken(token)
  const collections = await collectionService.getAll(user.id)

  return <CollectionsClient collections={collections} />
}
