/*
  Warnings:

  - You are about to drop the column `search_vector` on the `bookmarks` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_bookmarks_search_vector";

-- AlterTable
ALTER TABLE "bookmarks" DROP COLUMN "search_vector";
