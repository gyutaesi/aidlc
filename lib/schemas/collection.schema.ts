import { z } from 'zod'

const SlugSchema = z
  .string()
  .min(3, '슬러그는 3자 이상이어야 합니다')
  .max(50, '슬러그는 50자 이하여야 합니다')
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, '영문 소문자, 숫자, 하이픈만 사용 가능합니다')

export const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  template: z.enum(['guide', 'profile']).default('guide'),
})

export const UpdateCollectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  emoji: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  template: z.enum(['guide', 'profile']).optional(),
})

export const UpdateSlugSchema = z.object({
  slug: SlugSchema,
})

const LinkBlockContentSchema = z.object({
  bookmarkId: z.string().cuid().optional().nullable(),
  url: z.string().url().max(2048),
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  thumbnailUrl: z.string().url().max(2048).optional().nullable(),
  tags: z.array(z.string()).default([]),
})

const TextBlockContentSchema = z.object({
  markdown: z.string().max(5000),
})

const ImageBlockContentSchema = z.object({
  imageUrl: z.string().url().max(2048),
  alt: z.string().max(200).optional().nullable(),
  caption: z.string().max(500).optional().nullable(),
})

export const AddBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('link'), content: LinkBlockContentSchema }),
  z.object({ type: z.literal('text'), content: TextBlockContentSchema }),
  z.object({ type: z.literal('image'), content: ImageBlockContentSchema }),
])

export const UpdateBlockSchema = z.object({
  content: z.union([LinkBlockContentSchema, TextBlockContentSchema, ImageBlockContentSchema]),
})

export const ReorderBlocksSchema = z.object({
  orderedBlockIds: z.array(z.string()),
})

export type CreateCollectionInput = z.infer<typeof CreateCollectionSchema>
export type UpdateCollectionInput = z.infer<typeof UpdateCollectionSchema>
export type AddBlockInput = z.infer<typeof AddBlockSchema>
