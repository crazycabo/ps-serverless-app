import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import * as ssm from '@aws-cdk/aws-ssm';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import { NodejsServiceFunction } from '../constructs/lambda';

interface AppServicesProps {
  documentsTable: dynamodb.ITable;
  uploadBucket: s3.IBucket;
  assetBucket: s3.IBucket;
}

export class AppServices extends cdk.Construct {
  public readonly commentsService: NodejsFunction;
  public readonly documentsService: NodejsFunction;
  public readonly notificationsService: NodejsFunction;

  constructor(scope: cdk.Construct, id: string, props: AppServicesProps) {
    super(scope, id);

    // Comments Service -------------------------------------------------

    this.commentsService = new NodejsServiceFunction(this, 'CommentServiceLambda', {
      entry: path.join(__dirname, '../../../services/comments/index.js'),
    });

    props.documentsTable.grantReadWriteData(this.commentsService);

    this.commentsService.addToRolePolicy(
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['events:PutEvents'],
        }),
    );

    this.commentsService.addEnvironment('DYNAMO_DB_TABLE', props.documentsTable.tableName);

    // Documents Service ------------------------------------------------

    this.documentsService = new NodejsServiceFunction(this, 'DocumentServiceLambda', {
      entry: path.join(__dirname, '../../../services/documents/index.js'),
      timeout: cdk.Duration.seconds(10),
    });

    props.documentsTable.grantReadWriteData(this.documentsService);
    props.uploadBucket.grantWrite(this.documentsService);
    props.assetBucket.grantRead(this.documentsService);

    this.documentsService.addEnvironment('DYNAMO_DB_TABLE', props.documentsTable.tableName);
    this.documentsService.addEnvironment('UPLOAD_BUCKET', props.uploadBucket.bucketName);
    this.documentsService.addEnvironment('ASSET_BUCKET', props.assetBucket.bucketName);

    // Notifications Service ---------------------------------------------

    this.notificationsService = new NodejsServiceFunction(this, 'NotificationsServiceLambda', {
      entry: path.join(__dirname, '../../../services/notifications/index.js'),
    });

    this.notificationsService.addToRolePolicy(
        new iam.PolicyStatement({
          resources: ['*'],
          actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        }),
    );

    props.documentsTable.grantReadData(this.notificationsService);

    this.notificationsService.addEnvironment('DYNAMO_DB_TABLE', props.documentsTable.tableName);
    this.notificationsService.addEnvironment(
        'EMAIL_ADDRESS',
        ssm.StringParameter.valueForStringParameter(this, 'dms-globomantics-email'),
    );
  }
}
