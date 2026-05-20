'use client'

import ReactMarkdown from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { cn } from '@/lib/utils'

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'strong', 'em',
    'code', 'pre', 'blockquote', 'br', 'hr',
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: ['href', 'title'],
  },
  protocols: {
    href: ['http', 'https', 'mailto'],
  },
}

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert',
        'prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline',
        className
      )}
    >
      <ReactMarkdown
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={{
          a: ({ href, children, ...props }) => {
            // javascript: 프로토콜 차단
            const safehref =
              href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:'))
                ? href
                : '#'
            return (
              <a
                href={safehref}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
