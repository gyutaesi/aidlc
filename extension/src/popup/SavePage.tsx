import { useMemo, useState } from 'react'
import { apiClient } from '../api-client'
import { useAppStore } from '../store/useAppStore'
import { getErrorMessage } from '../errors'

interface SavePageProps {
  initialUrl: string
  initialTitle: string
  onSaveSuccess: () => void
}

const WEBAPP_URL = import.meta.env.VITE_WEBAPP_URL

function isValidUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

function parseTags(tagInput: string): string[] {
  return tagInput
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

export function SavePage({
  initialUrl,
  initialTitle,
  onSaveSuccess,
}: SavePageProps) {
  const groups = useAppStore((s) => s.groups)
  const savedUrls = useAppStore((s) => s.savedUrls)
  const showToast = useAppStore((s) => s.showToast)
  const invalidateSavedUrls = useAppStore((s) => s.invalidateSavedUrls)

  const [url] = useState(initialUrl)
  const [title, setTitle] = useState(initialTitle)
  const [memo, setMemo] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const isAlreadySaved = useMemo(
    () => savedUrls.includes(url),
    [savedUrls, url],
  )

  const isUrlValid = isValidUrl(url)
  const tags = useMemo(() => parseTags(tagInput), [tagInput])

  const handleSave = async () => {
    if (!isUrlValid || isSaving) return

    setIsSaving(true)
    try {
      await apiClient.postBookmark({
        url,
        title: title.trim() || url,
        memo: memo.trim() || undefined,
        tagNames: tags.length > 0 ? tags : undefined,
        groupId: selectedGroupId || undefined,
      })

      // 저장 성공 → 캐시 무효화 + 팝업 닫기
      await invalidateSavedUrls()
      onSaveSuccess()
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
      setIsSaving(false)
    }
  }

  // 이미 저장된 페이지: 저장 폼 대신 배너 표시
  if (isAlreadySaved) {
    return (
      <div
        className="px-4 py-6 flex flex-col gap-3"
        data-testid="save-page-already-saved"
      >
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="text-sm font-medium text-blue-900">
            이미 저장된 페이지입니다
          </div>
          <div className="text-xs text-blue-700 mt-1 truncate">{url}</div>
        </div>
        <a
          href={WEBAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-sm text-moaring-primary hover:underline"
          data-testid="save-page-open-webapp-link"
        >
          웹앱에서 보기 →
        </a>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-3" data-testid="save-page">
      {/* URL */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">URL</label>
        <div
          className="text-xs text-gray-700 truncate bg-gray-50 px-2 py-1.5 rounded"
          data-testid="save-page-url"
        >
          {url || '(URL 없음)'}
        </div>
      </div>

      {/* 제목 */}
      <div>
        <label htmlFor="save-title" className="block text-xs text-gray-500 mb-1">
          제목
        </label>
        <input
          id="save-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-moaring-primary"
          data-testid="save-page-title-input"
        />
      </div>

      {/* 그룹 */}
      <div>
        <label htmlFor="save-group" className="block text-xs text-gray-500 mb-1">
          그룹
        </label>
        <select
          id="save-group"
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-moaring-primary bg-white"
          data-testid="save-page-group-select"
        >
          <option value="">📥 인박스 (기본)</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.emoji ? `${group.emoji} ` : ''}
              {group.name}
            </option>
          ))}
        </select>
      </div>

      {/* 태그 */}
      <div>
        <label htmlFor="save-tags" className="block text-xs text-gray-500 mb-1">
          태그
        </label>
        <input
          id="save-tags"
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="태그 입력 (쉼표로 구분)"
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-moaring-primary"
          data-testid="save-page-tags-input"
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-block text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 메모 */}
      <div>
        <label htmlFor="save-memo" className="block text-xs text-gray-500 mb-1">
          메모
        </label>
        <textarea
          id="save-memo"
          rows={3}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택사항)"
          className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-moaring-primary resize-none"
          data-testid="save-page-memo-input"
        />
      </div>

      {/* 저장 버튼 */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!isUrlValid || isSaving}
        className="w-full bg-moaring-primary hover:bg-moaring-primary-hover text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="save-page-save-button"
      >
        {isSaving ? '저장 중...' : '저장하기'}
      </button>

      {!isUrlValid && (
        <p className="text-xs text-red-600 text-center">
          이 페이지는 저장할 수 없습니다 (HTTP/HTTPS만 지원)
        </p>
      )}
    </div>
  )
}
