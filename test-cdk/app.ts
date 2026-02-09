#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import type { Construct } from "constructs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 Bucket with large assets
    new s3.Bucket(this, "TestBucket", {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Lambda with bundled code (creates asset)
    new lambda.Function(this, "BundledFunction", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambda")),
    });

    // Another Lambda to generate more assets
    new lambda.Function(this, "InlineFunction", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Hello from Lambda!');
          return { statusCode: 200, body: 'OK' };
        };
      `),
    });

    // Docker image asset (creates dockerImages entry in *.assets.json)
    new ecr_assets.DockerImageAsset(this, "DockerAsset", {
      directory: path.join(__dirname, "docker"),
    });
  }
}

class SecondStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Use the same asset path (CDK will deduplicate to same hash)
    new lambda.Function(this, "SharedFunction", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambda")),
    });
  }
}

const app = new cdk.App();
new TestStack(app, "TestStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

// Second stack that shares the same asset
new SecondStack(app, "SecondStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
