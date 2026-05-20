import { z } from 'zod'

export const CreateBookmarkSchema = z.object({
  url: z.string().url('유효한 URL을 입력해 주세요').max(2048),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  thumbnailUrl: z.string().url().max(2048).optional().nullable(),
  memo: z.string().max(1000).optional(),
  tagNames: z.array(z.string().min(1).max(50)).optional().default([]),
  groupId: z.string().cuid().optional().nullable(),
})

export const UpdateBookmarkSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  thumbnailUrl: z.string().url().max(2048).optional().nullable(),
  memo: z.string().max(1000).optional().nullable(),
  tagNames: z.array(z.string().min(1).max(50)).optional(),
})

export const MoveToGroupSchema = z.object({
  groupId: z.string().cuid(),
})

export const InboxQuerySchema = z.object({
  sort: z.enum(['newest', 'oldest']).default('newest'),
  filter: z.enum(['all', 'read', 'unread']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type CreateBookmarkInput = z.infer<typeof CreateBookmarkSchema>
export type UpdateBookmarkInput = z.infer<typeof UpdateBookmarkSchema>
export type InboxQueryInput = z.infer<typeof InboxQuerySchema>
