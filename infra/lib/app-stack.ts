import * as cdk from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import { Construct } from 'constructs'
import { Config } from './config'

export interface AppStackProps extends cdk.StackProps {
  vpc: ec2.Vpc
  albSg: ec2.SecurityGroup
  ecsSg: ec2.SecurityGroup
  cluster: rds.DatabaseCluster
  dbSecret: secretsmanager.ISecret
  userPool: cognito.UserPool
  userPoolClient: cognito.UserPoolClient
  bucket: s3.Bucket
  distribution: cloudfront.Distribution
}

/**
 * AppStack
 *
 * ECR + ECS Cluster + Task Definition + ALB + Fargate Service.
 *
 * 핵심 구성:
 * - ECR: moaring-app, 최신 5개 이미지 보존
 * - ECS Cluster: moaring-cluster, Container Insights 비활성화
 * - Task Definition: 512 CPU / 1024 MB
 * - 환경변수: Parameter Store에서 SSM 동적 참조 (배포 시점에 값 fetch)
 * - DB 자격증명: Secrets Manager JSON 필드를 DB_HOST/DB_USER/DB_PASSWORD로 개별 주입
 * - ALB: HTTP:80, 헬스체크 /api/health
 * - Service: 태스크 1개, ECS Exec 활성화, minHealthyPercent 0
 */
export class AppStack extends cdk.Stack {
  public readonly ecrRepository: ecr.Repository
  public readonly cluster: ecs.Cluster
  public readonly service: ecs.FargateService
  public readonly alb: elbv2.ApplicationLoadBalancer
  public readonly logGroup: logs.LogGroup

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props)

    const {
      vpc,
      albSg,
      ecsSg,
      dbSecret,
      userPool,
      userPoolClient,
      bucket,
      distribution,
    } = props

    // ECR 레포지토리
    this.ecrRepository = new ecr.Repository(this, 'EcrRepo', {
      repositoryName: `${Config.projectName}-app`,
      imageScanOnPush: false, // demo
      lifecycleRules: [
        {
          maxImageCount: Config.ecr.maxImageCount,
          description: `Keep only the latest ${Config.ecr.maxImageCount} images`,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    })

    // CloudWatch Log Group (명시적 생성으로 보존/삭제 정책 제어)
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: Config.logs.logGroupName,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: `${Config.projectName}-cluster`,
      vpc,
      containerInsightsV2: ecs.ContainerInsights.DISABLED, // demo
    })

    // Task Execution Role (ECS 에이전트용)
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Role for ECS agent (image pull, log write, secrets fetch)',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy',
        ),
      ],
    })
    // Secrets Manager 접근 (DB 자격증명)
    dbSecret.grantRead(executionRole)

    // Task Role (앱 코드용)
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Role for application code (Parameter Store, S3, ECS Exec)',
    })
    // Parameter Store 읽기 권한
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameters', 'ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter${Config.parameterStore.pathPrefix}/*`,
        ],
      }),
    )
    // S3 버킷 접근 권한
    bucket.grantReadWrite(taskRole)
    // ECS Exec (SSM Session Manager)
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'ssmmessages:CreateControlChannel',
          'ssmmessages:CreateDataChannel',
          'ssmmessages:OpenControlChannel',
          'ssmmessages:OpenDataChannel',
        ],
        resources: ['*'],
      }),
    )

    // Task Definition
    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      family: `${Config.projectName}-app`,
      cpu: Config.ecs.cpu,
      memoryLimitMiB: Config.ecs.memoryLimitMiB,
      executionRole,
      taskRole,
    })

    // 컨테이너 정의
    taskDef.addContainer('AppContainer', {
      containerName: `${Config.projectName}-app`,
      image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, 'latest'),
      portMappings: [
        {
          containerPort: Config.ecs.containerPort,
          protocol: ecs.Protocol.TCP,
        },
      ],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs',
        logGroup: this.logGroup,
      }),
      environment: {
        // 하드코딩
        NODE_ENV: 'production',
        AWS_REGION: this.region,
        DB_NAME: Config.aurora.databaseName,
        DB_PORT: String(Config.aurora.port),
        // Parameter Store 정적 참조 (CDK가 배포 시점에 값 fetch)
        LOG_LEVEL: ssm.StringParameter.valueForStringParameter(
          this,
          `${Config.parameterStore.pathPrefix}/log-level`,
        ),
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        S3_BUCKET_NAME: bucket.bucketName,
        CLOUDFRONT_DOMAIN: `https://${distribution.distributionDomainName}`,
      },
      secrets: {
        // Secrets Manager JSON 필드를 개별 환경변수로 주입
        DB_HOST: ecs.Secret.fromSecretsManager(dbSecret, 'host'),
        DB_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
      },
    })

    // ALB (Public 서브넷)
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      loadBalancerName: `${Config.projectName}-alb`,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      internetFacing: true,
      securityGroup: albSg,
    })

    // ALB 리스너 + 타겟 그룹
    const listener = this.alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: false, // 보안 그룹은 NetworkStack에서 이미 설정됨
    })

    // ECS Fargate Service
    this.service = new ecs.FargateService(this, 'Service', {
      serviceName: `${Config.projectName}-service`,
      cluster: this.cluster,
      taskDefinition: taskDef,
      desiredCount: Config.ecs.desiredCount,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [ecsSg],
      assignPublicIp: false,
      enableExecuteCommand: true,
      minHealthyPercent: Config.ecs.minHealthyPercent,
      maxHealthyPercent: Config.ecs.maxHealthyPercent,
      healthCheckGracePeriod: cdk.Duration.seconds(
        Config.ecs.healthCheckGracePeriodSeconds,
      ),
      circuitBreaker: { rollback: true }, // 배포 실패 시 빠른 감지 + 롤백
    })

    // 타겟 그룹 등록 (헬스체크 포함)
    listener.addTargets('EcsTargets', {
      port: Config.ecs.containerPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [this.service],
      healthCheck: {
        path: Config.ecs.healthCheckPath,
        protocol: elbv2.Protocol.HTTP,
        interval: cdk.Duration.seconds(Config.ecs.healthCheckIntervalSeconds),
        timeout: cdk.Duration.seconds(Config.ecs.healthCheckTimeoutSeconds),
        healthyThresholdCount: Config.ecs.healthCheckHealthyThreshold,
        unhealthyThresholdCount: Config.ecs.healthCheckUnhealthyThreshold,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    })

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: this.ecrRepository.repositoryUri,
    })
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
    })
    new cdk.CfnOutput(this, 'AlbUrl', {
      value: `http://${this.alb.loadBalancerDnsName}`,
    })
  }
}
