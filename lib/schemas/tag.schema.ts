import { z } from 'zod'

export const TagNameSchema = z
  .string()
  .min(1, '태그 이름을 입력해 주세요')
  .max(50, '태그는 50자 이하여야 합니다')
  .transform((v) => v.toLowerCase().trim())

export const AutocompleteSchema = z.object({
  prefix: z.string().min(1).max(50),
  limit: z.coerce.number().int().min(1).max(20).default(10),
})

export type AutocompleteInput = z.infer<typeof AutocompleteSchema>
