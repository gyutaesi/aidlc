'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { importBookmarksAction } from '@/lib/actions/bookmark.actions'

export default function ImportPage() {
  const t = useTranslations('import')
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.endsWith('.html')) setFile(dropped)
    else toast.error(t('fileType'))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected?.name.endsWith('.html')) setFile(selected)
    else toast.error(t('fileType'))
  }

  async function handleImport() {
    if (!file) return
    setIsImporting(true)

    const formData = new FormData()
    formData.set('file', file)

    const result = await importBookmarksAction(formData)
    setIsImporting(false)

    if (result.success) {
      toast.success(t('success', { imported: result.imported ?? 0, failed: result.failed ?? 0 }))
      setFile(null)
    } else {
      toast.error(result.error ?? t('failed'))
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6" data-testid="import-page">
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground mb-6">{t('description')}</p>

      {/* 드롭존 */}
      <div
        className={`rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        data-testid="import-dropzone"
      >
        <Upload className="text-muted-foreground mx-auto mb-4 h-8 w-8" />
        <p className="text-muted-foreground text-sm">{t('dropzone')}</p>
        <p className="text-muted-foreground mt-1 text-xs">{t('fileType')}</p>

        <label className="mt-4 inline-block cursor-pointer">
          <input
            type="file"
            accept=".html"
            className="hidden"
            onChange={handleFileChange}
            data-testid="import-file-input"
          />
          <span className="hover:bg-accent rounded-md border px-3 py-1.5 text-sm">파일 선택</span>
        </label>
      </div>

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-md border p-3">
          <span className="text-sm">{file.name}</span>
          <Button onClick={handleImport} disabled={isImporting} data-testid="import-start-button">
            {isImporting ? t('importing') : 'Import 시작'}
          </Button>
        </div>
      )}
    </div>
  )
}
