'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { addBlockAction } from '@/lib/actions/collection.actions'

interface BlockAddModalProps {
  collectionId: string
  blockType: 'link' | 'text' | 'image' | null
  onClose: () => void
  onSuccess: () => void
}

// 링크 블록 폼
const LinkFormSchema = z.object({
  url: z.string().url('올바른 URL을 입력해주세요'),
  title: z.string().min(1, '제목을 입력해주세요').max(200),
  description: z.string().max(500).optional(),
})
type LinkFormData = z.infer<typeof LinkFormSchema>

function LinkForm({
  collectionId,
  onClose,
  onSuccess,
}: {
  collectionId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LinkFormData>({ resolver: zodResolver(LinkFormSchema) })

  async function fetchMeta(url: string) {
    if (!url.startsWith('http')) return
    try {
      const res = await fetch(`/api/bookmarks/metadata?url=${encodeURIComponent(url)}`)
      if (res.ok) {
        const meta = await res.json()
        if (meta.title) setValue('title', meta.title)
        if (meta.description) setValue('description', meta.description)
      }
    } catch {}
  }

  async function onSubmit(data: LinkFormData) {
    const result = await addBlockAction(collectionId, {
      type: 'link',
      content: {
        url: data.url,
        title: data.title,
        description: data.description ?? null,
        tags: [],
      },
    })
    if (result.success) {
      toast.success('링크 블록이 추가됐습니다')
      onSuccess()
    } else {
      toast.error(result.error ?? '추가에 실패했습니다')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">URL *</label>
        <Input
          {...register('url')}
          placeholder="https://example.com"
          onBlur={(e) => fetchMeta(e.target.value)}
        />
        {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">제목 *</label>
        <Input {...register('title')} placeholder="링크 제목" />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">설명</label>
        <Textarea {...register('description')} placeholder="설명 (선택)" rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '추가 중...' : '추가'}
        </Button>
      </div>
    </form>
  )
}

// 텍스트 블록 폼
const TextFormSchema = z.object({
  markdown: z.string().min(1, '내용을 입력해주세요').max(5000),
})
type TextFormData = z.infer<typeof TextFormSchema>

function TextForm({
  collectionId,
  onClose,
  onSuccess,
}: {
  collectionId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TextFormData>({ resolver: zodResolver(TextFormSchema) })

  async function onSubmit(data: TextFormData) {
    const result = await addBlockAction(collectionId, {
      type: 'text',
      content: { markdown: data.markdown },
    })
    if (result.success) {
      toast.success('텍스트 블록이 추가됐습니다')
      onSuccess()
    } else {
      toast.error(result.error ?? '추가에 실패했습니다')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">내용 (마크다운 지원) *</label>
        <Textarea
          {...register('markdown')}
          placeholder="## 제목&#10;내용을 입력하세요..."
          rows={6}
        />
        {errors.markdown && <p className="text-xs text-destructive">{errors.markdown.message}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '추가 중...' : '추가'}
        </Button>
      </div>
    </form>
  )
}

// 이미지 블록 폼
const ImageFormSchema = z.object({
  imageUrl: z.string().url('올바른 이미지 URL을 입력해주세요'),
  alt: z.string().max(200).optional(),
  caption: z.string().max(500).optional(),
})
type ImageFormData = z.infer<typeof ImageFormSchema>

function ImageForm({
  collectionId,
  onClose,
  onSuccess,
}: {
  collectionId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ImageFormData>({ resolver: zodResolver(ImageFormSchema) })

  async function onSubmit(data: ImageFormData) {
    const result = await addBlockAction(collectionId, {
      type: 'image',
      content: {
        imageUrl: data.imageUrl,
        alt: data.alt ?? null,
        caption: data.caption ?? null,
      },
    })
    if (result.success) {
      toast.success('이미지 블록이 추가됐습니다')
      onSuccess()
    } else {
      toast.error(result.error ?? '추가에 실패했습니다')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">이미지 URL *</label>
        <Input {...register('imageUrl')} placeholder="https://example.com/image.png" />
        {errors.imageUrl && <p className="text-xs text-destructive">{errors.imageUrl.message}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">대체 텍스트</label>
        <Input {...register('alt')} placeholder="이미지 설명" />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium">캡션</label>
        <Input {...register('caption')} placeholder="이미지 캡션" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '추가 중...' : '추가'}
        </Button>
      </div>
    </form>
  )
}

const TITLE_MAP = { link: '링크 블록 추가', text: '텍스트 블록 추가', image: '이미지 블록 추가' }

export function BlockAddModal({ collectionId, blockType, onClose, onSuccess }: BlockAddModalProps) {
  return (
    <Dialog
      open={blockType !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{blockType ? TITLE_MAP[blockType] : ''}</DialogTitle>
        </DialogHeader>

        {blockType === 'link' && (
          <LinkForm collectionId={collectionId} onClose={onClose} onSuccess={onSuccess} />
        )}
        {blockType === 'text' && (
          <TextForm collectionId={collectionId} onClose={onClose} onSuccess={onSuccess} />
        )}
        {blockType === 'image' && (
          <ImageForm collectionId={collectionId} onClose={onClose} onSuccess={onSuccess} />
        )}
      </DialogContent>
    </Dialog>
  )
}
