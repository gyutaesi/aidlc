'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Trash2, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DragDropList } from '@/components/ui/drag-drop-list'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AddBlockButton } from './add-block-button'
import {
  addBlockAction,
  deleteBlockAction,
  reorderBlocksAction,
} from '@/lib/actions/collection.actions'
import type { Block } from '@/lib/services/collection.service'

interface BlockListProps {
  collectionId: string
  blocks: Block[]
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

function LinkBlockItem({ block }: { block: Block }) {
  const content = block.content as {
    url: string
    title: string
    description?: string | null
    tags?: string[]
  }
  return (
    <div className="rounded-md border p-3" data-testid={`block-link-${block.id}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <a
            href={isSafeUrl(content.url) ? content.url : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-medium hover:underline"
            data-testid={`block-link-url-${block.id}`}
          >
            {content.title}
            <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          </a>
          {content.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{content.description}</p>
          )}
          {content.tags && content.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {content.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TextBlockItem({ block }: { block: Block }) {
  const content = block.content as { markdown: string }
  return (
    <div className="rounded-md border p-3" data-testid={`block-text-${block.id}`}>
      <MarkdownRenderer content={content.markdown} />
    </div>
  )
}

function ImageBlockItem({ block }: { block: Block }) {
  const content = block.content as {
    imageUrl: string
    alt?: string | null
    caption?: string | null
  }
  return (
    <div className="rounded-md border p-3" data-testid={`block-image-${block.id}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={content.imageUrl}
        alt={content.alt ?? ''}
        className="w-full rounded-md object-cover"
      />
      {content.caption && <p className="mt-1 text-xs text-muted-foreground">{content.caption}</p>}
    </div>
  )
}

export function BlockList({ collectionId, blocks }: BlockListProps) {
  const t = useTranslations('collection')
  const [localBlocks, setLocalBlocks] = useState(blocks)
  const [addModalType, setAddModalType] = useState<'link' | 'text' | 'image' | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkDescription, setLinkDescription] = useState('')
  const [textMarkdown, setTextMarkdown] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageCaption, setImageCaption] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  async function handleReorder(orderedIds: string[]) {
    const reordered = orderedIds.map((id, i) => {
      const block = localBlocks.find((b) => b.id === id)!
      return { ...block, position: i }
    })
    setLocalBlocks(reordered)

    const result = await reorderBlocksAction(collectionId, orderedIds)
    if (!result.success) {
      setLocalBlocks(blocks)
      toast.error(result.error)
    }
  }

  async function handleDeleteBlock(blockId: string) {
    const result = await deleteBlockAction(collectionId, blockId)
    if (!result.success) {
      toast.error(result.error)
    } else {
      setLocalBlocks((prev) => prev.filter((b) => b.id !== blockId))
    }
  }

  function handleAddBlock(type: 'link' | 'text' | 'image') {
    setAddModalType(type)
  }

  function resetModal() {
    setAddModalType(null)
    setLinkUrl('')
    setLinkTitle('')
    setLinkDescription('')
    setTextMarkdown('')
    setImageUrl('')
    setImageCaption('')
  }

  async function handleSubmitBlock() {
    setIsAdding(true)
    let data: unknown

    if (addModalType === 'link') {
      if (!linkUrl.trim() || !linkTitle.trim()) {
        toast.error('URL과 제목은 필수입니다')
        setIsAdding(false)
        return
      }
      data = {
        type: 'link',
        content: {
          url: linkUrl.trim(),
          title: linkTitle.trim(),
          description: linkDescription.trim() || null,
          tags: [],
        },
      }
    } else if (addModalType === 'text') {
      if (!textMarkdown.trim()) {
        toast.error('내용을 입력하세요')
        setIsAdding(false)
        return
      }
      data = { type: 'text', content: { markdown: textMarkdown.trim() } }
    } else if (addModalType === 'image') {
      if (!imageUrl.trim()) {
        toast.error('이미지 URL을 입력하세요')
        setIsAdding(false)
        return
      }
      data = {
        type: 'image',
        content: { imageUrl: imageUrl.trim(), alt: null, caption: imageCaption.trim() || null },
      }
    }

    const result = await addBlockAction(collectionId, data)
    if (result.success) {
      toast.success('블록이 추가되었습니다')
      resetModal()
      window.location.reload()
    } else {
      toast.error(result.error)
    }
    setIsAdding(false)
  }

  return (
    <div className="space-y-4" data-testid="block-list">
      {localBlocks.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground" data-testid="block-list-empty">
          <p className="text-sm">{t('empty')}</p>
          <p className="text-xs">{t('emptyDescription')}</p>
        </div>
      ) : (
        <DragDropList
          items={localBlocks}
          onReorder={handleReorder}
          renderItem={(block) => (
            <div className="group relative">
              {block.type === 'link' && <LinkBlockItem block={block} />}
              {block.type === 'text' && <TextBlockItem block={block} />}
              {block.type === 'image' && <ImageBlockItem block={block} />}

              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => handleDeleteBlock(block.id)}
                data-testid={`block-delete-${block.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        />
      )}

      <AddBlockButton onSelectType={handleAddBlock} />

      <Dialog
        open={addModalType !== null}
        onOpenChange={(open) => {
          if (!open) resetModal()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {addModalType === 'link' && t('blockTypeLink')}
              {addModalType === 'text' && t('blockTypeText')}
              {addModalType === 'image' && t('blockTypeImage')}
              {' 블록 추가'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {addModalType === 'link' && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">URL</label>
                  <Input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">제목</label>
                  <Input
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="링크 제목"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">설명 (선택)</label>
                  <Input
                    value={linkDescription}
                    onChange={(e) => setLinkDescription(e.target.value)}
                    placeholder="링크 설명"
                  />
                </div>
              </>
            )}
            {addModalType === 'text' && (
              <div className="space-y-1">
                <label className="text-sm font-medium">내용 (마크다운)</label>
                <Textarea
                  value={textMarkdown}
                  onChange={(e) => setTextMarkdown(e.target.value)}
                  placeholder="마크다운으로 작성하세요..."
                  rows={5}
                />
              </div>
            )}
            {addModalType === 'image' && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">이미지 URL</label>
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.png"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">캡션 (선택)</label>
                  <Input
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    placeholder="이미지 설명"
                  />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetModal}>
                취소
              </Button>
              <Button onClick={handleSubmitBlock} disabled={isAdding}>
                {isAdding ? '추가 중...' : '추가'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
