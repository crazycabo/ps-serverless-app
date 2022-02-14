import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import { ApplicationAPI } from './api';
import { AppDatabase } from './database';
import { AppServices } from './services';
import { AssetStorage } from './storage';
import { ApplicationEvents } from "./events";
import { ApplicationAuth } from "./auth";
import { ApplicationMonitoring} from "./monitoring";
import { DocumentProcessing } from "./processing";
import { WebApp } from './webapp';
import { PolicyStatement } from "@aws-cdk/aws-iam";

export class ApplicationStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const storage = new AssetStorage(this, 'Storage');
    const database = new AppDatabase(this, 'Database');
    const auth = new ApplicationAuth(this, 'Auth');

    const veryBadPolicy = new PolicyStatement({
      principals: [new iam.AccountPrincipal(cdk.Stack.of(this).account)],
      actions: ['*'],
      resources: [storage.assetBucket.bucketArn]
    })

    storage.assetBucket.addToResourcePolicy(veryBadPolicy);

    const services = new AppServices(this, 'Services', {
      documentsTable: database.documentsTable,
      uploadBucket: storage.uploadBucket,
      assetBucket: storage.assetBucket,
      userPool: auth.userPool,
    });

    const api = new ApplicationAPI(this, 'API', {
      commentsService: services.commentsService,
      documentsService: services.documentsService,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
      usersService: services.usersService,
    });

    const processing = new DocumentProcessing(this, 'Processing', {
      uploadBucket: storage.uploadBucket,
      assetBucket: storage.assetBucket,
      documentsTable: database.documentsTable,
    });

    new ApplicationEvents(this, 'Events', {
      uploadBucket: storage.uploadBucket,
      processingStateMachine: processing.processingStateMachine,
      notificationsService: services.notificationsService,
    });

    new WebApp(this, 'WebApp', {
      hostingBucket: storage.hostingBucket,
      baseDirectory: '../',
      relativeWebAppPath: 'webapp',
      httpApi: api.httpApi,
      userPool: auth.userPool,
      userPoolClient: auth.userPoolClient,
    });

    new ApplicationMonitoring(this, 'Monitoring', {
      api: api.httpApi,
      table: database.documentsTable,
      processingStateMachine: processing.processingStateMachine,
      assetsBucket: storage.assetBucket,
      documentsService: services.documentsService,
      commentsService: services.commentsService,
      usersService: services.usersService,
    });
  }
}
