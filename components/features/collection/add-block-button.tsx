'use client'

import { useState } from 'react'
import { Plus, Link, Type, Image } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

type BlockType = 'link' | 'text' | 'image'

interface AddBlockButtonProps {
  onSelectType: (type: BlockType) => void
}

export function AddBlockButton({ onSelectType }: AddBlockButtonProps) {
  const t = useTranslations('collection')
  const [isOpen, setIsOpen] = useState(false)

  const blockTypes: Array<{ type: BlockType; icon: React.ReactNode; label: string }> = [
    { type: 'link', icon: <Link className="h-4 w-4" />, label: t('blockTypeLink') },
    { type: 'text', icon: <Type className="h-4 w-4" />, label: t('blockTypeText') },
    { type: 'image', icon: <Image className="h-4 w-4" />, label: t('blockTypeImage') },
  ]

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        data-testid="add-block-button"
      >
        <Plus className="mr-2 h-4 w-4" />
        {t('addBlock')}
      </Button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 min-w-[160px] rounded-md border bg-popover p-1 shadow-md">
          {blockTypes.map(({ type, icon, label }) => (
            <button
              key={type}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => { onSelectType(type); setIsOpen(false) }}
              data-testid={`add-block-type-${type}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
