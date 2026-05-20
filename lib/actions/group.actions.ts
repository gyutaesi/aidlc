'use server'

import { revalidatePath } from 'next/cache'
import { groupService } from '@/lib/services/group.service'
import { authService } from '@/lib/services/auth.service'
import { getTokenFromCookies } from '@/lib/api/get-token'
import {
  CreateGroupSchema,
  UpdateGroupSchema,
  ReorderGroupsSchema,
  ReorderBookmarksSchema,
  ConvertToCollectionSchema,
} from '@/lib/schemas/group.schema'
import { UnauthorizedError } from '@/lib/errors'
import type { ActionResult } from './auth.actions'

async function getCurrentUser() {
  const token = await getTokenFromCookies()
  if (!token) throw new UnauthorizedError()
  return authService.getUserFromToken(token)
}

export async function createGroupAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    name: formData.get('name'),
    emoji: formData.get('emoji') || undefined,
  }

  const parsed = CreateGroupSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message }

  try {
    const user = await getCurrentUser()
    await groupService.create(user.id, parsed.data)
    revalidatePath('/[locale]/(dashboard)/groups', 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '생성에 실패했습니다' }
  }
}

export async function updateGroupAction(
  groupId: string,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    name: formData.get('name') || undefined,
    emoji: formData.get('emoji') || undefined,
  }

  const parsed = UpdateGroupSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message }

  try {
    const user = await getCurrentUser()
    await groupService.update(user.id, groupId, parsed.data)
    revalidatePath('/[locale]/(dashboard)/groups', 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '수정에 실패했습니다' }
  }
}

export async function deleteGroupAction(groupId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    await groupService.delete(user.id, groupId)
    revalidatePath('/[locale]/(dashboard)/groups', 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '삭제에 실패했습니다' }
  }
}

export async function reorderGroupsAction(orderedGroupIds: string[]): Promise<ActionResult> {
  const parsed = ReorderGroupsSchema.safeParse({ orderedGroupIds })
  if (!parsed.success) return { success: false, error: '잘못된 요청입니다' }

  try {
    const user = await getCurrentUser()
    await groupService.reorderGroups(user.id, parsed.data.orderedGroupIds)
    revalidatePath('/[locale]/(dashboard)/groups', 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '순서 변경에 실패했습니다' }
  }
}

export async function reorderBookmarksAction(
  groupId: string,
  orderedBookmarkIds: string[]
): Promise<ActionResult> {
  const parsed = ReorderBookmarksSchema.safeParse({ orderedBookmarkIds })
  if (!parsed.success) return { success: false, error: '잘못된 요청입니다' }

  try {
    const user = await getCurrentUser()
    await groupService.reorderBookmarks(user.id, groupId, parsed.data.orderedBookmarkIds)
    revalidatePath('/[locale]/(dashboard)/groups', 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '순서 변경에 실패했습니다' }
  }
}

export async function convertToCollectionAction(
  groupId: string,
  data: { bookmarkIds: string[]; collection: { name: string; template: 'guide' | 'profile' } }
): Promise<ActionResult & { collectionId?: string }> {
  const parsed = ConvertToCollectionSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message }

  try {
    const user = await getCurrentUser()
    const result = await groupService.convertToCollection(user.id, groupId, parsed.data)
    revalidatePath('/[locale]/(dashboard)/collections', 'page')
    return { success: true, collectionId: result.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '변환에 실패했습니다' }
  }
}
