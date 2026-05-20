import { load } from 'cheerio'
import { logger } from '@/lib/logger'

export interface UrlMetadata {
  title: string
  description: string | null
  thumbnailUrl: string | null
  favicon: string | null
}

export class MetadataService {
  private readonly TIMEOUT_MS = 5000

  async fetchMetadata(url: string): Promise<UrlMetadata | null> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'moaring-bot/1.0 (+https://moaring.app)',
          Accept: 'text/html',
        },
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        logger.warn('OG fetch: non-OK response', { url, status: response.status })
        return null
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/html')) {
        return null
      }

      const html = await response.text()
      return this.parseOgTags(html, url)
    } catch (error) {
      clearTimeout(timeoutId)
      logger.warn('OG fetch failed', {
        url,
        error: error instanceof Error ? error.message : 'Unknown',
      })
      return null
    }
  }

  private parseOgTags(html: string, baseUrl: string): UrlMetadata {
    const $ = load(html)

    const title =
      $('meta[property="og:title"]').attr('content') ??
      $('meta[name="twitter:title"]').attr('content') ??
      $('title').text().trim() ??
      new URL(baseUrl).hostname

    const description =
      $('meta[property="og:description"]').attr('content') ??
      $('meta[name="description"]').attr('content') ??
      null

    const thumbnailUrl =
      $('meta[property="og:image"]').attr('content') ??
      $('meta[name="twitter:image"]').attr('content') ??
      null

    const favicon =
      $('link[rel="icon"]').attr('href') ??
      $('link[rel="shortcut icon"]').attr('href') ??
      null

    return {
      title: title.slice(0, 200),
      description: description ? description.slice(0, 500) : null,
      thumbnailUrl: this.resolveUrl(thumbnailUrl, baseUrl),
      favicon: this.resolveUrl(favicon, baseUrl),
    }
  }

  private resolveUrl(url: string | null, baseUrl: string): string | null {
    if (!url) return null
    try {
      return new URL(url, baseUrl).href
    } catch {
      return null
    }
  }
}

export const metadataService = new MetadataService()
