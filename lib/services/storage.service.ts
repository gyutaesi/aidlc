import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import path from 'path'
import { env } from '@/lib/env'
import { ValidationError } from '@/lib/errors'

const s3Client = new S3Client({ region: env.AWS_REGION })

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export interface PresignedUploadResult {
  uploadUrl: string
  key: string
  publicUrl: string
}

export class StorageService {
  /**
   * S3 업로드용 Pre-signed URL 생성
   */
  async getUploadUrl(
    userId: string,
    type: 'collection-image' | 'thumbnail',
    filename: string
  ): Promise<PresignedUploadResult> {
    const ext = path.extname(filename).toLowerCase()

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new ValidationError(`허용되지 않는 파일 형식입니다. 허용: ${ALLOWED_EXTENSIONS.join(', ')}`)
    }

    const { customAlphabet } = await import('nanoid')
    const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)
    const key = `users/${userId}/${type}/${nanoid()}${ext}`

    const command = new PutObjectCommand({
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
      ContentType: MIME_TYPES[ext] ?? 'application/octet-stream',
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }) // 5분

    return {
      uploadUrl,
      key,
      publicUrl: this.toPublicUrl(key),
    }
  }

  /**
   * S3 key를 CloudFront 공개 URL로 변환
   */
  toPublicUrl(s3Key: string): string {
    return `https://${env.AWS_CLOUDFRONT_DOMAIN}/${s3Key}`
  }

  /**
   * S3 파일 삭제 (userId로 경로 소유권 검증)
   */
  async deleteFile(userId: string, s3Key: string): Promise<void> {
    // 경로 소유권 검증
    if (!s3Key.startsWith(`users/${userId}/`)) {
      throw new ValidationError('파일 삭제 권한이 없습니다')
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
      })
    )
  }
}

export const storageService = new StorageService()
