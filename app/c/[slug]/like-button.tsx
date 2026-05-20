'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PublicLikeButtonProps {
  collectionId: string
  likeCount: number
}

export function PublicLikeButton({ collectionId, likeCount: initialCount }: PublicLikeButtonProps) {
  const router = useRouter()
  const [count, setCount] = useState(initialCount)
  const [liked, setLiked] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleLike() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/collections/${collectionId}/like`, { method: 'POST' })

      if (res.status === 401) {
        // 로그인 필요 → 로그인 페이지로 redirect
        router.push(`/ko/login?redirect=/c/${collectionId}`)
        return
      }

      if (res.ok) {
        const data = await res.json()
        setLiked(data.liked)
        setCount(data.likeCount)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLike}
      disabled={isLoading}
      className={liked ? 'text-red-500' : ''}
      data-testid="like-button"
    >
      <Heart className={`mr-1 h-4 w-4 ${liked ? 'fill-current' : ''}`} />
      {count}
    </Button>
  )
}
