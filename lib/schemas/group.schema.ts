import { z } from 'zod'

export const CreateGroupSchema = z.object({
  name: z.string().min(1, '그룹 이름을 입력해 주세요').max(50),
  emoji: z.string().optional().nullable(),
})

export const UpdateGroupSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  emoji: z.string().optional().nullable(),
})

export const ReorderGroupsSchema = z.object({
  orderedGroupIds: z.array(z.string().cuid()),
})

export const ReorderBookmarksSchema = z.object({
  orderedBookmarkIds: z.array(z.string().cuid()),
})

export const ConvertToCollectionSchema = z.object({
  bookmarkIds: z.array(z.string().cuid()).min(1, '최소 1개의 북마크를 선택해 주세요'),
  collection: z.object({
    name: z.string().min(1).max(100),
    emoji: z.string().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    template: z.enum(['guide', 'profile']).default('guide'),
  }),
})

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>
export type ConvertToCollectionInput = z.infer<typeof ConvertToCollectionSchema>
