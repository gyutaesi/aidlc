'use client'

import { useState, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { X } from 'lucide-react'
import { Badge } from './badge'
import { Input } from './input'
import { cn } from '@/lib/utils'

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
  'data-testid'?: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function TagInput({
  value,
  onChange,
  placeholder = '태그 입력 후 Enter',
  className,
  'data-testid': testId = 'tag-input',
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: suggestions = [] } = useSWR<Array<{ id: string; name: string }>>(
    inputValue.trim().length > 0 ? `/api/tags?prefix=${encodeURIComponent(inputValue)}` : null,
    fetcher
  )

  const addTag = useCallback(
    (tag: string) => {
      const normalized = tag.toLowerCase().trim()
      if (!normalized || value.includes(normalized)) return
      onChange([...value, normalized])
      setInputValue('')
      setShowSuggestions(false)
    },
    [value, onChange]
  )

  const removeTag = useCallback(
    (tag: string) => {
      onChange(value.filter((t) => t !== tag))
    },
    [value, onChange]
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className={cn('space-y-2', className)} data-testid={testId}>
      <div className="flex flex-wrap gap-1">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1" data-testid={`tag-badge-${tag}`}>
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full hover:bg-muted"
              aria-label={`태그 ${tag} 제거`}
              data-testid={`tag-remove-${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowSuggestions(true)
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={placeholder}
          data-testid={`${testId}-field`}
        />

        {showSuggestions && suggestions.length > 0 && (
          <div
            className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md"
            data-testid={`${testId}-suggestions`}
          >
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={() => addTag(s.name)}
                data-testid={`tag-suggestion-${s.name}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
