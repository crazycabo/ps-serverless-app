import * as cdk from '@aws-cdk/core';
import { CdkPipeline, SimpleSynthAction } from '@aws-cdk/pipelines';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import { GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';
import { ApplicationStack } from '../core';

class AppStage extends cdk.Stage {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);

    new ApplicationStack(this, 'AppStack');
  }
}

export class ApplicationPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sourceArtifact = new codepipeline.Artifact();
    const cloudAssemblyArtifact = new codepipeline.Artifact();

    const dockerHubUsername = cdk.SecretValue.secretsManager('dockerhub_credentials', {
      jsonField: 'username'
    });
    const dockerHubPassword = cdk.SecretValue.secretsManager('dockerhub_credentials', {
      jsonField: 'password'
    });

    const pipeline = new CdkPipeline(this, 'Pipeline', {
      pipelineName: 'DMSPipeline',
      cloudAssemblyArtifact,
      crossAccountKeys: false,
      sourceAction: new GitHubSourceAction({
        actionName: 'GitHub',
        output: sourceArtifact,
        oauthToken: cdk.SecretValue.secretsManager('dms_config', {
          jsonField: 'github_token'
        }),
        owner: 'crazycabo',
        repo: 'ps-serverless-app',
        branch: 'p6-active-dev'
      }),
      synthAction: SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        subdirectory: 'infrastructure',
        installCommand: 'cd .. && yarn install && cd infrastructure && docker login -u "' + dockerHubUsername + '" -p "' + dockerHubPassword + '"',
        environment: {
          privileged: true,
        },
      }),
    });

    pipeline.addApplicationStage(new AppStage(this, 'Staging'));
  }
}
