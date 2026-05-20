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

-- Collection blocks_text: GENERATED ALWAYS로는 서브쿼리 불가 → 일반 컬럼 + 트리거 사용
ALTER TABLE "collections"
ADD COLUMN IF NOT EXISTS blocks_text text;

-- 기존 행 초기화
UPDATE "collections"
SET blocks_text = (
  SELECT string_agg(block->'content'->>'markdown', ' ')
  FROM jsonb_array_elements(blocks) AS block
  WHERE block->>'type' = 'text'
);

-- Collection 풀텍스트 검색 벡터 (일반 컬럼 + 트리거)
ALTER TABLE "collections"
ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE "collections"
SET search_vector = to_tsvector('simple',
  coalesce(name, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(blocks_text, '')
);

CREATE INDEX IF NOT EXISTS idx_collections_search_vector
ON "collections" USING GIN(search_vector);

-- blocks_text + search_vector 자동 갱신 트리거
CREATE OR REPLACE FUNCTION collections_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.blocks_text := (
    SELECT string_agg(block->'content'->>'markdown', ' ')
    FROM jsonb_array_elements(NEW.blocks) AS block
    WHERE block->>'type' = 'text'
  );
  NEW.search_vector := to_tsvector('simple',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.blocks_text, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS collections_search_vector_trigger ON "collections";
CREATE TRIGGER collections_search_vector_trigger
BEFORE INSERT OR UPDATE ON "collections"
FOR EACH ROW EXECUTE FUNCTION collections_search_vector_update();
