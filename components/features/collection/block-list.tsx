'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Trash2, ExternalLink } from 'lucide-react'
import { DragDropList } from '@/components/ui/drag-drop-list'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AddBlockButton } from './add-block-button'
import { deleteBlockAction, reorderBlocksAction } from '@/lib/actions/collection.actions'
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
            <ExternalLink className="text-muted-foreground h-3 w-3 flex-shrink-0" />
          </a>
          {content.description && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{content.description}</p>
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
      {content.caption && <p className="text-muted-foreground mt-1 text-xs">{content.caption}</p>}
    </div>
  )
}

export function BlockList({ collectionId, blocks }: BlockListProps) {
  const t = useTranslations('collection')
  const [localBlocks, setLocalBlocks] = useState(blocks)

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
    toast.info(`${type} 블록 추가 기능`)
  }

  return (
    <div className="space-y-4" data-testid="block-list">
      {localBlocks.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center" data-testid="block-list-empty">
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
    </div>
  )
}
