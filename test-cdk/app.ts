#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ecr_assets from "aws-cdk-lib/aws-ecr-assets";
import type { Construct } from "constructs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Asset } from "aws-cdk-lib/aws-s3-assets";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Lambda with bundled code (creates asset)
    new lambda.Function(this, "BundledFunction", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambda")),
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

    // Nested stack
    const nested = new cdk.NestedStack(this, "NestedStack");
    new lambda.Function(nested, "NestedFunction", {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "lambda")),
    });
  }
}

class ThirdStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 Asset
    new Asset(this, "S3Asset", {
      path: path.join(__dirname, "s3", "test.txt"),
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

// Stage (creates assembly-MyStage/ directory)
const stage = new cdk.Stage(app, "MyStage");
new ThirdStack(stage, "ThirdStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
