import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as cloudtrail from '@aws-cdk/aws-cloudtrail';

export class AssetStorage extends cdk.Construct {
  public readonly uploadBucket: s3.IBucket;

  public readonly hostingBucket: s3.IBucket;

  public readonly assetBucket: s3.IBucket;

  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    this.uploadBucket = new s3.Bucket(this, 'UploadBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    this.assetBucket = new s3.Bucket(this, 'AssetBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,

    });

    this.hostingBucket = new s3.Bucket(this, 'WebHostingBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Upload bucket requires CloudTrail to get API requests
    const trail = new cloudtrail.Trail(this, id);

    trail.addS3EventSelector([{
      bucket: this.uploadBucket,
    }]);
  }
}
