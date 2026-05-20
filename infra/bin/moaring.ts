#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib'
import { AppStack } from '../lib/app-stack'
import { AuthStack } from '../lib/auth-stack'
import { Config } from '../lib/config'
import { ConfigStack } from '../lib/config-stack'
import { DatabaseStack } from '../lib/database-stack'
import { NetworkStack } from '../lib/network-stack'
import { StorageStack } from '../lib/storage-stack'

/**
 * moaring CDK App 진입점
 *
 * AWS 계정/리전은 환경변수 CDK_DEFAULT_ACCOUNT, CDK_DEFAULT_REGION에서 읽음.
 * 로컬에서 `aws configure`로 설정한 프로파일 사용.
 *
 * 배포 명령:
 *   cdk bootstrap aws://{account}/ap-northeast-2  # 최초 1회
 *   cdk deploy --all                              # 전체 배포
 *   cdk destroy --all                             # 전체 삭제
 */

const app = new cdk.App()

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? Config.region,
}

const stackPrefix = `${Config.projectName}-${Config.env}`

// 1. 네트워크 (독립)
const networkStack = new NetworkStack(app, `${stackPrefix}-network`, { env })

// 2. 데이터베이스 (Network 의존)
const databaseStack = new DatabaseStack(app, `${stackPrefix}-database`, {
  env,
  vpc: networkStack.vpc,
  dbSg: networkStack.dbSg,
})

// 3. 인증 (독립)
const authStack = new AuthStack(app, `${stackPrefix}-auth`, { env })

// 4. 스토리지 (독립)
const storageStack = new StorageStack(app, `${stackPrefix}-storage`, { env })

// 5. 앱 (모든 스택 의존)
const appStack = new AppStack(app, `${stackPrefix}-app`, {
  env,
  vpc: networkStack.vpc,
  albSg: networkStack.albSg,
  ecsSg: networkStack.ecsSg,
  cluster: databaseStack.cluster,
  dbSecret: databaseStack.dbSecret,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  bucket: storageStack.bucket,
  distribution: storageStack.distribution,
})

// 6. 설정 (Parameter Store 저장)
const configStack = new ConfigStack(app, `${stackPrefix}-config`, {
  env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  bucket: storageStack.bucket,
  distribution: storageStack.distribution,
})

// AppStack의 ECS Task가 ConfigStack의 SSM 파라미터를 참조하므로 의존성 추가
appStack.addDependency(configStack)

// 모든 스택에 공통 태그 적용
for (const [key, value] of Object.entries(Config.tags)) {
  cdk.Tags.of(app).add(key, value)
}
