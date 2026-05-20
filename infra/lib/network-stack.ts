import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'
import { Config } from './config'

/**
 * NetworkStack
 *
 * VPC, 서브넷, 보안 그룹, NAT Gateway 프로비저닝.
 * 모든 다른 스택의 기반이 되는 네트워크 인프라.
 *
 * 구성:
 * - VPC: 10.0.0.0/16, 2 AZ
 * - Public 서브넷 2개 (ALB)
 * - Private 서브넷 2개 (ECS + Aurora 공용)
 * - NAT Gateway 1개 (demo 비용 절감)
 * - 보안 그룹 체인: alb-sg → ecs-sg → db-sg
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc
  public readonly albSg: ec2.SecurityGroup
  public readonly ecsSg: ec2.SecurityGroup
  public readonly dbSg: ec2.SecurityGroup

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // VPC: Public + Private 서브넷, NAT Gateway 1개
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${Config.projectName}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr(Config.vpc.cidr),
      maxAzs: Config.vpc.maxAzs,
      natGateways: Config.vpc.natGateways,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    })

    // ALB 보안 그룹: 인터넷에서 HTTP:80 허용
    this.albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc: this.vpc,
      securityGroupName: `${Config.projectName}-alb-sg`,
      description: 'Security group for ALB',
      allowAllOutbound: true,
    })
    this.albSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP from internet',
    )

    // ECS 보안 그룹: ALB에서 컨테이너 포트(3000) 허용
    this.ecsSg = new ec2.SecurityGroup(this, 'EcsSg', {
      vpc: this.vpc,
      securityGroupName: `${Config.projectName}-ecs-sg`,
      description: 'Security group for ECS Fargate tasks',
      allowAllOutbound: true,
    })
    this.ecsSg.addIngressRule(
      this.albSg,
      ec2.Port.tcp(Config.ecs.containerPort),
      'Allow traffic from ALB to container port',
    )

    // DB 보안 그룹: ECS에서 PostgreSQL 포트(5432) 허용
    this.dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: this.vpc,
      securityGroupName: `${Config.projectName}-db-sg`,
      description: 'Security group for Aurora PostgreSQL',
      allowAllOutbound: false, // DB는 아웃바운드 불필요
    })
    this.dbSg.addIngressRule(
      this.ecsSg,
      ec2.Port.tcp(Config.aurora.port),
      'Allow PostgreSQL from ECS',
    )

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId })
  }
}
