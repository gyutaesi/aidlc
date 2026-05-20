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

-- Collection 블록 텍스트 추출 (JSONB 텍스트 블록)
ALTER TABLE "collections"
ADD COLUMN IF NOT EXISTS blocks_text text
GENERATED ALWAYS AS (
  (
    SELECT string_agg(block->'content'->>'markdown', ' ')
    FROM jsonb_array_elements(blocks) AS block
    WHERE block->>'type' = 'text'
  )
) STORED;

-- Collection 풀텍스트 검색 벡터 (이름 + 설명 + 블록 텍스트)
ALTER TABLE "collections"
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  to_tsvector('simple',
    coalesce(name, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(
      (
        SELECT string_agg(block->'content'->>'markdown', ' ')
        FROM jsonb_array_elements(blocks) AS block
        WHERE block->>'type' = 'text'
      ),
      ''
    )
  )
) STORED;

CREATE INDEX IF NOT EXISTS idx_collections_search_vector
ON "collections" USING GIN(search_vector);
