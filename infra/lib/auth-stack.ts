import * as cdk from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import { Construct } from 'constructs'
import { Config } from './config'

/**
 * AuthStack
 *
 * Cognito User Pool + App Client 프로비저닝.
 *
 * 구성:
 * - 로그인 식별자: 이메일
 * - 이메일 인증: 필수 (Cognito 기본 이메일 발송)
 * - MFA: 없음 (demo)
 * - 비밀번호 정책: 최소 8자, 대소문자+숫자
 * - App Client: Client Secret 없음 (SPA/Extension 직접 호출)
 * - Access/ID Token: 1시간, Refresh Token: 30일
 */
export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient
  public readonly userPoolDomain: cognito.UserPoolDomain

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${Config.projectName}-user-pool`,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: false, // demo: 이메일 인증 비활성화
      },
      selfSignUpEnabled: true,
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: Config.cognito.passwordMinLength,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      mfa: cognito.Mfa.OFF,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // demo
    })

    // Cognito Hosted UI 도메인 (Extension PKCE 플로우에 필요)
    this.userPoolDomain = this.userPool.addDomain('Domain', {
      cognitoDomain: {
        domainPrefix: Config.projectName, // moaring.auth.us-east-1.amazoncognito.com
      },
    })

    // App Client (Secret 없음 — SPA/Extension용)
    this.userPoolClient = this.userPool.addClient('AppClient', {
      userPoolClientName: `${Config.projectName}-app-client`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true, // Extension PKCE 플로우
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        // Chrome Extension redirect URI는 배포 후 수동 추가 필요
        // chrome-extension://{extension-id}/ 형태
        callbackUrls: ['http://localhost:3000/api/auth/callback'],
        logoutUrls: ['http://localhost:3000/login'],
      },
      accessTokenValidity: cdk.Duration.minutes(Config.cognito.accessTokenValidityMinutes),
      idTokenValidity: cdk.Duration.minutes(Config.cognito.idTokenValidityMinutes),
      refreshTokenValidity: cdk.Duration.days(Config.cognito.refreshTokenValidityDays),
      preventUserExistenceErrors: true,
    })

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
    })
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    })
    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: this.userPoolDomain.domainName,
      description: 'Cognito Hosted UI domain prefix (for Extension PKCE)',
    })
  }
}
