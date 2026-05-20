import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'
import { Config } from './config'

export interface DatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc
  dbSg: ec2.SecurityGroup
}

/**
 * DatabaseStack
 *
 * Aurora PostgreSQL Serverless v2 클러스터 프로비저닝.
 *
 * 구성:
 * - 엔진: Aurora PostgreSQL 15.x
 * - 인스턴스: Writer 1개 (Serverless v2)
 * - ACU: Min 0.5 / Max 4
 * - 자격증명: Secrets Manager 자동 생성 (moaring_admin)
 * - DB 자동 생성: defaultDatabaseName=moaring
 * - 백업: 1일 보존
 * - 삭제 정책: DESTROY (demo)
 */
export class DatabaseStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster
  public readonly dbSecret: secretsmanager.ISecret

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props)

    const { vpc, dbSg } = props

    // Aurora Serverless v2 클러스터
    this.cluster = new rds.DatabaseCluster(this, 'Cluster', {
      clusterIdentifier: `${Config.projectName}-db`,
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_8,
      }),
      writer: rds.ClusterInstance.serverlessV2('Writer', {
        publiclyAccessible: false,
      }),
      serverlessV2MinCapacity: Config.aurora.minAcu,
      serverlessV2MaxCapacity: Config.aurora.maxAcu,
      defaultDatabaseName: Config.aurora.databaseName,
      credentials: rds.Credentials.fromGeneratedSecret(Config.aurora.username, {
        secretName: `${Config.parameterStore.pathPrefix}/db-credentials`,
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      backup: {
        retention: cdk.Duration.days(Config.aurora.backupRetentionDays),
      },
      storageEncrypted: true,
      deletionProtection: false, // demo
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // dbSecret은 cluster.secret에서 가져옴
    if (!this.cluster.secret) {
      throw new Error('Aurora cluster secret is not available')
    }
    this.dbSecret = this.cluster.secret

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      value: this.cluster.clusterEndpoint.hostname,
    })
    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.dbSecret.secretArn,
    })
  }
}
