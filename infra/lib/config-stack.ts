import * as cdk from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import { Config } from './config'

export interface ConfigStackProps extends cdk.StackProps {
  userPool: cognito.UserPool
  userPoolClient: cognito.UserPoolClient
  bucket: s3.Bucket
  distribution: cloudfront.Distribution
}

/**
 * ConfigStack
 *
 * Parameter Store에 비민감 설정값 저장.
 * ECS Task가 SSM 동적 참조로 이 값들을 환경변수로 주입받음.
 *
 * 저장 항목 (모두 String, 비민감):
 * - log-level: 'info' (운영 중 변경 가능)
 * - cognito-user-pool-id
 * - cognito-client-id
 * - s3-bucket-name
 * - cloudfront-domain
 * - aws-region
 *
 * 참고: DB 자격증명은 Secrets Manager가 자동 관리 (Parameter Store 미사용)
 */
export class ConfigStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ConfigStackProps) {
    super(scope, id, props)

    const { userPool, userPoolClient, bucket, distribution } = props
    const prefix = Config.parameterStore.pathPrefix

    new ssm.StringParameter(this, 'LogLevel', {
      parameterName: `${prefix}/log-level`,
      stringValue: Config.parameterStore.initialLogLevel,
      description: 'Application log level (info, debug, warn, error)',
    })

    new ssm.StringParameter(this, 'CognitoUserPoolId', {
      parameterName: `${prefix}/cognito-user-pool-id`,
      stringValue: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    })

    new ssm.StringParameter(this, 'CognitoClientId', {
      parameterName: `${prefix}/cognito-client-id`,
      stringValue: userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
    })

    new ssm.StringParameter(this, 'S3BucketName', {
      parameterName: `${prefix}/s3-bucket-name`,
      stringValue: bucket.bucketName,
      description: 'S3 storage bucket name',
    })

    new ssm.StringParameter(this, 'CloudFrontDomain', {
      parameterName: `${prefix}/cloudfront-domain`,
      stringValue: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront distribution domain (with https://)',
    })

    new ssm.StringParameter(this, 'AwsRegion', {
      parameterName: `${prefix}/aws-region`,
      stringValue: this.region,
      description: 'AWS deployment region',
    })
  }
}
