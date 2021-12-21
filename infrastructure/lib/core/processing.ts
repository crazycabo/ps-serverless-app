import * as path from 'path';
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import { NodejsServiceFunction } from '../constructs/lambda';

interface DocumentProcessingProps {
    uploadBucket: s3.IBucket;
    assetBucket: s3.IBucket;
    documentsTable: dynamodb.ITable;
}

export class DocumentProcessing extends cdk.Construct {

    public readonly processingStateMachine: sfn.IStateMachine;

    constructor(scope: cdk.Construct, id: string, props: DocumentProcessingProps) {

        super(scope, id);

        // Metadata Service ---------------------------------------------------------

        const getDocumentMetadata = new NodejsServiceFunction(this, 'MetadataLambda', {
            entry: path.join(__dirname, '../../../services/processing/metadata.js'),
            timeout: cdk.Duration.seconds(120),
        });

        getDocumentMetadata.addEnvironment('UPLOAD_BUCKET', props.uploadBucket.bucketName);
        getDocumentMetadata.addEnvironment('ASSETS_BUCKET', props.assetBucket.bucketName);

        props.uploadBucket.grantRead(getDocumentMetadata);
        props.assetBucket.grantWrite(getDocumentMetadata);

        const getDocumentMetadataInvoke = new tasks.LambdaInvoke(this, 'Get Document Metadata', {
            lambdaFunction: getDocumentMetadata,
            outputPath: '$.Payload',
        });

        // Thumbnail Service --------------------------------------------------------

        const createThumbnail = new NodejsServiceFunction(this, 'ThumbnailLambda', {
            entry: path.join(__dirname, '../../../services/processing/thumbnail.js'),
            timeout: cdk.Duration.seconds(120),
            layers: [
                lambda.LayerVersion.fromLayerVersionAttributes(this, 'GhostscriptLayerVersion', {
                    layerVersionArn: 'arn:aws:lambda:us-east-2:764866452798:layer:ghostscript:8',
                    compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
                }),
            ],
        });

        createThumbnail.addEnvironment('UPLOAD_BUCKET', props.uploadBucket.bucketName);
        createThumbnail.addEnvironment('ASSET_BUCKET', props.assetBucket.bucketName);

        props.uploadBucket.grantRead(createThumbnail);
        props.assetBucket.grantWrite(createThumbnail);

        const createThumbnailInvoke = new tasks.LambdaInvoke(this, 'Create Document Thumbnail', {
            lambdaFunction: createThumbnail,
            outputPath: '$.Payload',
        });

        // Start Text Detection Service ---------------------------------------------

        const startTextDetection = new NodejsServiceFunction(this, 'StartTextDetectionLambda', {
            entry: path.join(__dirname, '../../../services/processing/startTextDetection.js'),
        });

        startTextDetection.addEnvironment('UPLOAD_BUCKET', props.uploadBucket.bucketName);
        startTextDetection.addToRolePolicy(
            new iam.PolicyStatement({
                resources: ['*'],
                actions: ['textract:StartDocumentTextDetection'],
            }),
        );

        props.uploadBucket.grantReadWrite(startTextDetection);

        const startTextDetectionInvoke = new tasks.LambdaInvoke(this, 'Start Text Detection Process', {
            lambdaFunction: startTextDetection,
            outputPath: '$.Payload',
        });

        // Get Text Detection Results Service ---------------------------------------

        const getTextDetectionResults = new NodejsServiceFunction(this, 'GetTextDetectionLambda', {
            entry: path.join(__dirname, '../../../services/processing/parseTextDetectionResults.js'),
            timeout: cdk.Duration.seconds(300),
        });

        getTextDetectionResults.addToRolePolicy(
            new iam.PolicyStatement({
                resources: ['*'],
                actions: ['textract:GetDocumentTextDetection'],
            }),
        );

        const getTextDetectionResultsInvoke = new tasks.LambdaInvoke(this, 'Get Text Detection Results', {
            lambdaFunction: getTextDetectionResults,
            outputPath: '$.Payload',
        });

        getTextDetectionResultsInvoke.addRetry({
            maxAttempts: 100,
            interval: cdk.Duration.seconds(5),
            backoffRate: 2,
        });

        // Insert Document into DB --------------------------------------------------

        const insertDocument = new NodejsServiceFunction(this, 'InsertDocumentLambda', {
            entry: path.join(__dirname, '../../../services/processing/insert.js'),
        });

        insertDocument.addEnvironment('DYNAMO_DB_TABLE', props.documentsTable.tableName);
        insertDocument.addEnvironment('UPLOAD_BUCKET', props.uploadBucket.bucketName);
        insertDocument.addEnvironment('ASSET_BUCKET', props.assetBucket.bucketName);

        props.uploadBucket.grantReadWrite(insertDocument);
        props.assetBucket.grantReadWrite(insertDocument);

        insertDocument.addToRolePolicy(
            new iam.PolicyStatement({
                resources: [props.documentsTable.tableArn],
                actions: ['dynamodb:UpdateItem'],
            }),
        );

        const insertDocumentInvoke = new tasks.LambdaInvoke(this, 'Insert Document into Database', {
            lambdaFunction: insertDocument,
            outputPath: '$.Payload',
        });
    }
}