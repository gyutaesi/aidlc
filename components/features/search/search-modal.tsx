'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import useSWR from 'swr'
import { Search, BookmarkIcon, FolderOpen, X } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { SearchResult } from '@/lib/services/search.service'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const t = useTranslations('search')
  const router = useRouter()
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const { data: results = [] } = useSWR<SearchResult[]>(
    query.trim().length > 0 ? `/api/search?q=${encodeURIComponent(query)}` : null,
    fetcher
  )

  // Cmd+K / Ctrl+K 단축키
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  // 모달 닫힐 때 초기화
  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (result.type === 'bookmark' && result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
      } else if (result.type === 'collection') {
        router.push(`/${locale}/collections/${result.id}`)
      }
      onOpenChange(false)
    },
    [router, locale, onOpenChange]
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex])
    } else if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  const bookmarkResults = results.filter((r) => r.type === 'bookmark')
  const collectionResults = results.filter((r) => r.type === 'collection')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0" data-testid="search-modal">
        <div className="flex items-center border-b px-3">
          <Search className="text-muted-foreground mr-2 h-4 w-4 flex-shrink-0" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            className="border-0 shadow-none focus-visible:ring-0"
            autoFocus
            data-testid="search-input"
          />
          {query && (
            <button onClick={() => setQuery('')} data-testid="search-clear">
              <X className="text-muted-foreground h-4 w-4" />
            </button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2" data-testid="search-results">
          {query && results.length === 0 && (
            <p
              className="text-muted-foreground py-4 text-center text-sm"
              data-testid="search-empty"
            >
              {t('empty')}
            </p>
          )}

          {bookmarkResults.length > 0 && (
            <div className="mb-2">
              <p className="text-muted-foreground mb-1 px-2 text-xs font-medium">
                {t('bookmarks')}
              </p>
              {bookmarkResults.map((result) => (
                <button
                  key={result.id}
                  className={`hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                    results.indexOf(result) === selectedIndex ? 'bg-accent' : ''
                  }`}
                  onClick={() => handleSelect(result)}
                  data-testid={`search-result-${result.id}`}
                >
                  <BookmarkIcon className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{result.title}</p>
                    {result.url && (
                      <p className="text-muted-foreground truncate text-xs">{result.url}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {collectionResults.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1 px-2 text-xs font-medium">
                {t('collections')}
              </p>
              {collectionResults.map((result) => (
                <button
                  key={result.id}
                  className={`hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                    results.indexOf(result) === selectedIndex ? 'bg-accent' : ''
                  }`}
                  onClick={() => handleSelect(result)}
                  data-testid={`search-result-${result.id}`}
                >
                  <FolderOpen className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                  <p className="truncate font-medium">{result.title}</p>
                </button>
              ))}
            </div>
          )}

          {!query && <p className="text-muted-foreground py-4 text-center text-xs">{t('hint')}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
