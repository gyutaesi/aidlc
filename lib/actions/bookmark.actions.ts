'use server'

import { revalidatePath } from 'next/cache'
import { bookmarkService } from '@/lib/services/bookmark.service'
import { authService } from '@/lib/services/auth.service'
import { getTokenFromCookies } from '@/lib/api/get-token'
import { CreateBookmarkSchema, UpdateBookmarkSchema } from '@/lib/schemas/bookmark.schema'
import { UnauthorizedError } from '@/lib/errors'
import type { ActionResult } from './auth.actions'

async function getCurrentUser() {
  const token = await getTokenFromCookies()
  if (!token) throw new UnauthorizedError()
  return authService.getUserFromToken(token)
}

/**
 * 북마크 생성
 */
export async function createBookmarkAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    url: formData.get('url'),
    title: formData.get('title') || undefined,
    description: formData.get('description') || undefined,
    memo: formData.get('memo') || undefined,
    tagNames: formData.getAll('tagNames') as string[],
    groupId: formData.get('groupId') || undefined,
  }

  const parsed = CreateBookmarkSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message }
  }

  try {
    const user = await getCurrentUser()
    await bookmarkService.create(user.id, parsed.data)

    revalidatePath('/[locale]/(dashboard)/inbox', 'page')
    revalidatePath('/[locale]/(dashboard)/groups', 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '저장에 실패했습니다' }
  }
}

/**
 * 북마크 수정
 */
export async function updateBookmarkAction(
  bookmarkId: string,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    title: formData.get('title') || undefined,
    description: formData.get('description') || undefined,
    memo: formData.get('memo') || undefined,
    tagNames: formData.getAll('tagNames') as string[],
  }

  const parsed = UpdateBookmarkSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message }
  }

  try {
    const user = await getCurrentUser()
    await bookmarkService.update(user.id, bookmarkId, parsed.data)

    revalidatePath('/[locale]/(dashboard)/inbox', 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '수정에 실패했습니다' }
  }
}

/**
 * 북마크 삭제
 */
export async function deleteBookmarkAction(bookmarkId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    await bookmarkService.delete(user.id, bookmarkId)

    revalidatePath('/[locale]/(dashboard)/inbox', 'page')
    revalidatePath('/[locale]/(dashboard)/groups', 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '삭제에 실패했습니다' }
  }
}

/**
 * 읽음 처리
 */
export async function markAsReadAction(bookmarkId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    await bookmarkService.markAsRead(user.id, bookmarkId)
    revalidatePath('/[locale]/(dashboard)/inbox', 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '처리에 실패했습니다' }
  }
}

/**
 * 읽지 않음 처리
 */
export async function markAsUnreadAction(bookmarkId: string): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    await bookmarkService.markAsUnread(user.id, bookmarkId)
    revalidatePath('/[locale]/(dashboard)/inbox', 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '처리에 실패했습니다' }
  }
}

/**
 * 그룹으로 이동
 */
export async function moveToGroupAction(
  bookmarkId: string,
  groupId: string
): Promise<ActionResult> {
  try {
    const user = await getCurrentUser()
    await bookmarkService.moveToGroup(user.id, bookmarkId, groupId)

    revalidatePath('/[locale]/(dashboard)/inbox', 'page')
    revalidatePath('/[locale]/(dashboard)/groups', 'page')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '이동에 실패했습니다' }
  }
}

/**
 * 크롬 북마크 HTML Import
 */
export async function importBookmarksAction(formData: FormData): Promise<ActionResult & { imported?: number; failed?: number }> {
  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: '파일을 선택해 주세요' }

  try {
    const user = await getCurrentUser()
    const htmlContent = await file.text()
    const result = await bookmarkService.importFromHtml(user.id, htmlContent)

    revalidatePath('/[locale]/(dashboard)/inbox', 'page')
    return { success: true, imported: result.imported, failed: result.failed }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '가져오기에 실패했습니다' }
  }
}
