import * as AWS from 'aws-sdk';
import * as debug from 'debug';
import * as path from 'path';

import * as config from '../../config';

const hat = require('hat');

const d = debug('nucleus:s3');

AWS.config.credentials = new AWS.EC2MetadataCredentials({
  httpOptions: { timeout: 5000 },
  maxRetries: 10,
});

export default class S3Store implements IFileStore {
  constructor(private s3Config = config.s3) {}

  public async putFile(key: string, data: Buffer, overwrite = false) {
    d(`Putting file: '${key}', overwrite=${overwrite ? 'true' : 'false'}`);
    const s3 = new AWS.S3();
    const keyExists = async () => await new Promise<boolean>(resolve => s3.headObject({
      Bucket: this.s3Config.bucketName,
      Key: key,
    }, (err) => {
      if (err && err.code === 'NotFound') return resolve(false);
      resolve(true);
    }));
    let wrote = false;
    if (overwrite || !await keyExists()) {
      d(`Deciding to write file (either because overwrite is enabled or the key didn't exist)`);
      await new Promise((resolve, reject) => s3.putObject({
        Bucket: this.s3Config.bucketName,
        Key: key,
        Body: data,
        ACL: 'public-read',
      }, (err, data) => {
        if (err) return reject(err);
        resolve();
      }));
      wrote = true;
    }
    if (overwrite && this.s3Config.cloudfront) {
      d(`Cloudfront config detected, sending invalidation request for: '${key}'`);
      const cloudFront = new AWS.CloudFront();
      cloudFront.createInvalidation({
        DistributionId: this.s3Config.cloudfront.distributionId,
        InvalidationBatch: {
          CallerReference: hat(),
          Paths: {
            Quantity: 1,
            Items: [`/${key}`],
          },
        },
      }, (err, invalidateInfo) => {
        if (err) console.error('Failed to invalidate:', key, ' Error:', err);
      });
    }
    return wrote;
  }

  public async getFile(key: string) {
    d(`Fetching file: '${key}'`);
    return await new Promise<Buffer>((resolve) => {
      const s3 = new AWS.S3();
      s3.getObject({
        Bucket: this.s3Config.bucketName,
        Key: key,
      }, (err, data) => {
        if (err) {
          d('File not found, defaulting to empty buffer');
          return resolve(Buffer.from(''));
        }
        resolve(data.Body as Buffer);
      });
    });
  }

  public async deletePath(key: string) {
    d(`Deleting files under path: '${key}'`);
    const s3 = new AWS.S3();
    const keys = await this.listFiles(key);
    d(`Found objects to delete: [${keys.join(', ')}]`);
    await new Promise((resolve) => {
      s3.deleteObjects({
        Bucket: this.s3Config.bucketName,
        Delete: {
          Objects: keys.map(key => ({
            Key: key,
          })),
        },
      }, () => resolve());
    });
  }

  public async getPublicBaseUrl() {
    if (this.s3Config.cloudfront) {
      return this.s3Config.cloudfront.publicUrl;
    }
    return `https://${this.s3Config.bucketName}.s3.amazonaws.com`;
  }

  public async listFiles(prefix: string) {
    d(`Listing files under path: '${prefix}'`);
    const s3 = new AWS.S3();
    const objects = await new Promise<AWS.S3.Object[]>((resolve) => {
      s3.listObjects({
        Bucket: this.s3Config.bucketName,
        Prefix: prefix,
      }, (err, data) => {
        resolve(data.Contents);
      });
    });
    return objects.map(object => object.Key);
  }
}
