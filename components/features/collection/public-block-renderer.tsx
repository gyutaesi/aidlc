'use client'

import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'
import { Badge } from '@/components/ui/badge'
import type { Block } from '@/lib/services/collection.service'

interface PublicBlockRendererProps {
  blocks: Block[]
  collectionId: string
  template: 'guide' | 'profile'
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

async function recordClick(collectionId: string, blockId: string) {
  try {
    await fetch(`/api/collections/${collectionId}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockId }),
    })
  } catch {
    // 통계 기록 실패는 무시
  }
}

function LinkBlock({
  block,
  collectionId,
  index,
  template,
}: {
  block: Block
  collectionId: string
  index: number
  template: 'guide' | 'profile'
}) {
  const content = block.content as {
    url: string; title: string; description?: string | null; thumbnailUrl?: string | null; tags?: string[]
  }
  const safeUrl = isSafeUrl(content.url) ? content.url : '#'

  if (template === 'guide') {
    return (
      <div className="flex gap-4 rounded-lg border p-4" data-testid={`public-block-link-${block.id}`}>
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-medium hover:underline"
            onClick={() => recordClick(collectionId, block.id)}
            data-testid={`public-link-${block.id}`}
          >
            {content.title}
            <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          </a>
          {content.description && (
            <p className="mt-1 text-sm text-muted-foreground">{content.description}</p>
          )}
        </div>
      </div>
    )
  }

  // profile 템플릿 — 카드 그리드
  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border p-4 transition-shadow hover:shadow-md"
      onClick={() => recordClick(collectionId, block.id)}
      data-testid={`public-block-link-${block.id}`}
    >
      {content.thumbnailUrl && (
        <Image
          src={content.thumbnailUrl}
          alt={content.title}
          width={400}
          height={200}
          className="mb-3 h-32 w-full rounded-md object-cover"
        />
      )}
      <p className="font-medium">{content.title}</p>
      {content.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{content.description}</p>
      )}
      {content.tags && content.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {content.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
      )}
    </a>
  )
}

export function PublicBlockRenderer({ blocks, collectionId, template }: PublicBlockRendererProps) {
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position)

  const containerClass =
    template === 'profile'
      ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
      : 'space-y-4'

  return (
    <div className={containerClass} data-testid="public-block-renderer">
      {sortedBlocks.map((block, index) => {
        if (block.type === 'link') {
          return (
            <LinkBlock
              key={block.id}
              block={block}
              collectionId={collectionId}
              index={index}
              template={template}
            />
          )
        }

        if (block.type === 'text') {
          const content = block.content as { markdown: string }
          return (
            <div key={block.id} className="rounded-lg border p-4" data-testid={`public-block-text-${block.id}`}>
              <MarkdownRenderer content={content.markdown} />
            </div>
          )
        }

        if (block.type === 'image') {
          const content = block.content as { imageUrl: string; alt?: string | null; caption?: string | null }
          return (
            <div key={block.id} className="rounded-lg border p-4" data-testid={`public-block-image-${block.id}`}>
              <Image
                src={content.imageUrl}
                alt={content.alt ?? ''}
                width={800}
                height={400}
                className="w-full rounded-md object-cover"
              />
              {content.caption && (
                <p className="mt-2 text-center text-sm text-muted-foreground">{content.caption}</p>
              )}
            </div>
          )
        }

        return null
      })}
    </div>
  )
}
