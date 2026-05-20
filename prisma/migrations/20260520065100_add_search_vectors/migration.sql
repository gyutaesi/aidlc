-- Bookmark 풀텍스트 검색 벡터 (제목 + URL + 메모)
ALTER TABLE "bookmarks"
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('simple',
    coalesce(title, '') || ' ' ||
    coalesce(url, '') || ' ' ||
    coalesce(memo, '')
  )
) STORED;

CREATE INDEX IF NOT EXISTS idx_bookmarks_search_vector
ON "bookmarks" USING GIN(search_vector);
