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
  public async putFile(key: string, data: Buffer, overwrite = false) {
    d(`Putting file: '${key}', overwrite=${overwrite ? 'true' : 'false'}`);
    const s3 = new AWS.S3();
    const keyExists = async () => await new Promise<boolean>(resolve => s3.headObject({
      Bucket: config.s3.bucketName,
      Key: key,
    }, (err) => {
      if (err && err.code === 'NotFound') return resolve(false);
      resolve(true);
    }));
    let wrote = false;
    if (overwrite || !await keyExists()) {
      d(`Deciding to write file (either because overwrite is enabled or the key didn't exist)`);
      await new Promise((resolve, reject) => s3.putObject({
        Bucket: config.s3.bucketName,
        Key: key,
        Body: data,
        ACL: 'public-read',
      }, (err, data) => {
        if (err) return reject(err);
        resolve();
      }));
      wrote = true;
    }
    if (overwrite && config.s3.cloudfront) {
      d(`Cloudfront config detected, sending invalidation request for: '${key}'`);
      const cloudFront = new AWS.CloudFront();
      cloudFront.createInvalidation({
        DistributionId: config.s3.cloudfront.distributionId,
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
        Bucket: config.s3.bucketName,
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
    const objects = await new Promise<AWS.S3.Object[]>((resolve) => {
      s3.listObjects({
        Bucket: config.s3.bucketName,
        Prefix: key,
      }, (err, data) => {
        resolve(data.Contents);
      });
    });
    d(`Found objects to delete: [${objects.map(object => object.Key).join(', ')}]`);
    await new Promise((resolve) => {
      s3.deleteObjects({
        Bucket: config.s3.bucketName,
        Delete: {
          Objects: objects.map(object => ({
            Key: object.Key,
          })),
        },
      }, () => resolve());
    });
  }

  public async getPublicBaseUrl() {
    if (config.s3.cloudfront) {
      return config.s3.cloudfront.publicUrl;
    }
    return `https://${config.s3.bucketName}.s3.amazonaws.com`;
  }
}
