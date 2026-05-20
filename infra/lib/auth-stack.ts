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

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${Config.projectName}-user-pool`,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
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

    // App Client (Secret 없음 — SPA/Extension용)
    this.userPoolClient = this.userPool.addClient('AppClient', {
      userPoolClientName: `${Config.projectName}-app-client`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      accessTokenValidity: cdk.Duration.minutes(
        Config.cognito.accessTokenValidityMinutes,
      ),
      idTokenValidity: cdk.Duration.minutes(
        Config.cognito.idTokenValidityMinutes,
      ),
      refreshTokenValidity: cdk.Duration.days(
        Config.cognito.refreshTokenValidityDays,
      ),
      preventUserExistenceErrors: true,
    })

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
    })
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    })
  }
}
