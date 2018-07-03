import * as AWS from 'aws-sdk';
import * as debug from 'debug';

import S3Store from './S3Store';

const hat = require('hat');

const d = debug('nucleus:s3:cloudfront-invalidator');

const invalidators: {
  [id: string]: CloudFrontBatchInvalidator;
} = {};

export class CloudFrontBatchInvalidator {
  private lastAdd: number = 0;
  private queue: string[] = [];
  nextTimer: NodeJS.Timer;

  static noopInvalidator = new CloudFrontBatchInvalidator(null);

  static get(store: S3Store) {
    if (!store.s3Config.cloudfront) {
      return CloudFrontBatchInvalidator.noopInvalidator;
    }
    if (!invalidators[store.s3Config.cloudfront.distributionId]) {
      invalidators[store.s3Config.cloudfront.distributionId] = new CloudFrontBatchInvalidator(store.s3Config.cloudfront);
    }
    return invalidators[store.s3Config.cloudfront.distributionId];
  }

  private constructor(private cloudfrontConfig: S3Options['cloudfront']) {
    if (cloudfrontConfig) {
      this.queueUp();
    }
  }

  public addToBatch = (key: string) => {
    if (!this.cloudfrontConfig) return;
    this.queue.push(`/${key}`);
    this.lastAdd = Date.now();
  }

  private queueUp() {
    clearTimeout(this.nextTimer);
    this.nextTimer = setTimeout(() => this.runJob(), 30000);
  }

  runJob() {
    if (this.queue.length === 0 || Date.now() - this.lastAdd <= 20000) {
      return this.queueUp();
    }
    d('running cloudfront batch invalidator');
    const itemsToUse = this.queue.slice(0, 500);
    this.queue = this.queue.slice(500);

    const cloudFront = new AWS.CloudFront();
    cloudFront.createInvalidation({
      DistributionId: this.cloudfrontConfig!.distributionId,
      InvalidationBatch: {
        CallerReference: hat(),
        Paths: {
          Quantity: itemsToUse.length,
          Items: itemsToUse,
        },
      },
    }, (err, invalidateInfo) => {
      if (err) {
        console.error({
          err,
          message: 'Failed to invalidate',
          keys: itemsToUse,
        });
        this.queue.push(...itemsToUse);
      } else {
        d('batch invalidation succeeded, moving along');
      }
      this.queueUp();
    });
  }
}
