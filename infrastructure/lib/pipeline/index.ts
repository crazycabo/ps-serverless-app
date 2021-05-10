import * as cdk from '@aws-cdk/core';
import { CdkPipeline, SimpleSynthAction } from '@aws-cdk/pipelines';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';

export class ApplicationPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sourceArtifact = new codepipeline.Artifact();
    const cloudAssemblyArtifact = new codepipeline.Artifact();

    new CdkPipeline(this, 'Pipeline', {
      pipelineName: 'MyAppPipeline',
      cloudAssemblyArtifact,

      sourceAction: new GitHubSourceAction({
        actionName: 'GitHub',
        output: sourceArtifact,
        oauthToken: cdk.SecretValue.secretsManager('GITHUB_TOKEN'),
        owner: 'davidtucker',
        repo: 'ps-serverless-app',
        branch: 'main'
      }),

      synthAction: SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        subdirectory: 'infrastructure',
        installCommand: 'cd .. && yarn install && cd infrastructure',
        environment: {
          privileged: true,
        },
      }),
    });
  }
}