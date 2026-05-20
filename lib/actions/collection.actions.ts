'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { collectionService } from '@/lib/services/collection.service'
import { authService } from '@/lib/services/auth.service'
import { getTokenFromCookies } from '@/lib/api/get-token'
import {
  CreateCollectionSchema,
  UpdateCollectionSchema,
  AddBlockSchema,
  UpdateSlugSchema,
  ReorderBlocksSchema,
} from '@/lib/schemas/collection.schema'
import { UnauthorizedError } from '@/lib/errors'
import type { ActionResult } from './auth.actions'

async function getCurrentUser() {
  const token = await getTokenFromCookies()
  if (!token) throw new UnauthorizedError()
  return authService.getUserFromToken(token)
}

export async function createCollectionAction(
  data: unknown
): Promise<ActionResult & { collectionId?: string }> {
  const parsed = CreateCollectionSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message }

  try {
    const user = await getCurrentUser()
    const collection = await collectionService.create(user.id, parsed.data)
    revalidatePath('/[locale]/(dashboard)/collections', 'page')
    return { success: true, collectionId: collection.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '생성에 실패했습니다' }
  }
}

export async function updateCollectionAction(
  collectionId: string,
  data: unknown
): Promise<ActionResult> {
  const parsed = UpdateCollectionSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message }

  try {
    const user = await getCurrentUser()
    await collectionService.update(user.id, collectionId, parsed.data)
    revalidatePath('/[locale]/(dashboard)/collections', 'page')
    revalidatePath(`/[locale]/(dashboard)/collections/${collectionId}`, 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '수정에 실패했습니다' }
  }
}

export async function deleteCollectionAction(collectionId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    const collection = await collectionService.getById(user.id, collectionId)
    await collectionService.delete(user.id, collectionId)
    revalidatePath('/[locale]/(dashboard)/collections', 'page')
    revalidatePath(`/c/${collection.slug}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '삭제에 실패했습니다' }
  }
}

export async function addBlockAction(
  collectionId: string,
  data: unknown
): Promise<ActionResult> {
  const parsed = AddBlockSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message }

  try {
    const user = await getCurrentUser()
    await collectionService.addBlock(user.id, collectionId, parsed.data)
    revalidatePath(`/[locale]/(dashboard)/collections/${collectionId}`, 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '블록 추가에 실패했습니다' }
  }
}

export async function updateBlockAction(
  collectionId: string,
  blockId: string,
  content: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    await collectionService.updateBlock(user.id, collectionId, blockId, content)
    revalidatePath(`/[locale]/(dashboard)/collections/${collectionId}`, 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '블록 수정에 실패했습니다' }
  }
}

export async function deleteBlockAction(
  collectionId: string,
  blockId: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    await collectionService.deleteBlock(user.id, collectionId, blockId)
    revalidatePath(`/[locale]/(dashboard)/collections/${collectionId}`, 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '블록 삭제에 실패했습니다' }
  }
}

export async function reorderBlocksAction(
  collectionId: string,
  orderedBlockIds: string[]
): Promise<ActionResult> {
  const parsed = ReorderBlocksSchema.safeParse({ orderedBlockIds })
  if (!parsed.success) return { success: false, error: '잘못된 요청입니다' }

  try {
    const user = await getCurrentUser()
    await collectionService.reorderBlocks(user.id, collectionId, parsed.data.orderedBlockIds)
    revalidatePath(`/[locale]/(dashboard)/collections/${collectionId}`, 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '순서 변경에 실패했습니다' }
  }
}

export async function togglePublicAction(collectionId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    const collection = await collectionService.togglePublic(user.id, collectionId)
    revalidatePath(`/[locale]/(dashboard)/collections/${collectionId}`, 'page')
    revalidatePath(`/c/${collection.slug}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '공유 설정에 실패했습니다' }
  }
}

export async function updateSlugAction(
  collectionId: string,
  slug: string
): Promise<ActionResult> {
  const parsed = UpdateSlugSchema.safeParse({ slug })
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message }

  try {
    const user = await getCurrentUser()
    const oldCollection = await collectionService.getById(user.id, collectionId)
    await collectionService.updateSlug(user.id, collectionId, parsed.data.slug)
    revalidatePath(`/c/${oldCollection.slug}`)
    revalidatePath(`/c/${parsed.data.slug}`)
    revalidateTag(`collection-${collectionId}`)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '슬러그 변경에 실패했습니다' }
  }
}
