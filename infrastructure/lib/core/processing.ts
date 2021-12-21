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
    }
}