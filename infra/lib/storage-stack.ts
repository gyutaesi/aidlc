import * as cdk from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import { Config } from './config'

/**
 * StorageStack
 *
 * S3 버킷 + CloudFront CDN 프로비저닝.
 *
 * 구성:
 * - S3: 단일 버킷, 퍼블릭 접근 차단, OAC만 허용
 * - CORS: PUT/GET 허용 (Pre-signed URL 업로드용)
 * - CloudFront: OAC, Gzip/Brotli 압축, 1일 TTL, PRICE_CLASS_100
 * - 삭제 정책: DESTROY + autoDeleteObjects (demo)
 */
export class StorageStack extends cdk.Stack {
  public readonly bucket: s3.Bucket
  public readonly distribution: cloudfront.Distribution

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // S3 버킷
    this.bucket = new s3.Bucket(this, 'StorageBucket', {
      bucketName: `${Config.projectName}-storage-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'], // demo
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // CloudFront Distribution (OAC 사용)
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        compress: true,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.ALLOW_ALL, // demo
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      comment: `${Config.projectName} CDN`,
    })

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
    })
    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: `https://${this.distribution.distributionDomainName}`,
    })
  }
}
