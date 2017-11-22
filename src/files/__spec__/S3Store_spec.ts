import * as AWS from 'aws-sdk';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { createStubInstance, stub, SinonStubbedInstance, SinonSpy } from 'sinon';

import S3Store from '../s3/S3Store';

describe('S3Store', () => {
  let store: S3Store;
  let S3: typeof AWS.S3;
  /* tslint:disable */
  let CloudFront: typeof AWS.CloudFront;
  /* tslint:enable */
  let s3Watcher: EventEmitter;
  let cloudFrontWatcher: EventEmitter;
  let s3Config: S3Options;


  beforeEach(async () => {
    s3Config = {
      bucketName: 'myBucket',
      cloudfront: null,
    };
    store = new S3Store(s3Config);
    S3 = AWS.S3;
    CloudFront = AWS.CloudFront;
    s3Watcher = new EventEmitter();
    cloudFrontWatcher = new EventEmitter();
    /* tslint:disable */
    (AWS as any).S3 = function () {
      const instance = new S3();
      stub(instance, 'headObject');
      stub(instance, 'putObject');
      stub(instance, 'getObject');
      s3Watcher.emit('new', instance);
      return instance;
    };
    (AWS as any).CloudFront = function () {
      class FakeCloudFront { createInvalidation() {} }
      const instance = new FakeCloudFront();
      stub(instance, 'createInvalidation');
      cloudFrontWatcher.emit('new', instance);
      return instance;
    };
    /* tslint:enable */
  });

  afterEach(() => {
    (AWS as any).S3 = S3;
  });

  describe('getPublicBaseUrl', () => {
    it('should return the calculated S3 URL', async () => {
      expect(await store.getPublicBaseUrl()).to.equal('https://myBucket.s3.amazonaws.com');
    });

    it('should return the cloudfront static URL if provided', async () => {
      s3Config.cloudfront = {
        distributionId: '0',
        publicUrl: 'https://this.is.custom/lel',
      };
      expect(await store.getPublicBaseUrl()).to.equal('https://this.is.custom/lel');
      delete s3Config.cloudfront;
    });
  });

  describe('putFile', () => {
    it('should write files to the correct key', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.once('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.headObject.callsArgWith(1, { code: 'NotFound' });
        instance.putObject.callsArgWith(1, null);
      });
      expect(await store.putFile('myKey', Buffer.from('value'))).to.equal(true);
      expect(s3.putObject.callCount).to.equal(1);
      expect(s3.putObject.firstCall.args[0]).to.have.property('Key', 'myKey');
    });

    it('should not overwrite files by default', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.once('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.headObject.callsArgWith(1, null);
        instance.putObject.callsArgWith(1, null);
      });
      expect(await store.putFile('myKey', Buffer.from('value'))).to.equal(false);
      expect(s3.putObject.callCount).to.equal(0);
    });

    it('should overwrite files when overwrite = true', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.once('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.headObject.callsArgWith(1, null);
        instance.putObject.callsArgWith(1, null);
      });
      expect(await store.putFile('myKey', Buffer.from('value'), true)).to.equal(true);
      expect(s3.putObject.callCount).to.equal(1);
    });

    it('should put objects with appropriate read config', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.once('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.headObject.callsArgWith(1, null);
        instance.putObject.callsArgWith(1, null);
      });
      expect(await store.putFile('myKey', Buffer.from('value'), true)).to.equal(true);
      expect(s3.putObject.callCount).to.equal(1);
      expect(s3.putObject.firstCall.args[0]).to.deep.equal({
        Bucket: 'myBucket',
        Key: 'myKey',
        Body: Buffer.from('value'),
        ACL: 'public-read',
      });
    });

    it('should trigger a cloudFront invalidation if cloudFront settings are set', async () => {
      s3Config.cloudfront = {
        distributionId: '0id',
        publicUrl: 'https://this.is.custom/lel',
      };
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.once('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.headObject.callsArgWith(1, null);
        instance.putObject.callsArgWith(1, null);
      });
      let cf: SinonStubbedInstance<AWS.CloudFront>;
      cloudFrontWatcher.on('new', (instance: SinonStubbedInstance<AWS.CloudFront>) => {
        cf = instance;
      });
      expect(await store.putFile('myKey', Buffer.from('value'), true)).to.equal(true);
      expect(cf.createInvalidation.callCount).to.equal(1);
      const invalidateOptions = cf.createInvalidation.firstCall.args[0];
      expect(invalidateOptions).to.have.property('DistributionId', '0id');
      expect(invalidateOptions.InvalidationBatch.Paths.Quantity).to.equal(1);
      expect(invalidateOptions.InvalidationBatch.Paths.Items).to.deep.equal(['/myKey']);
      delete s3Config.cloudfront;
    });
  });

  describe('getFile', () => {
    it('should default to empty string buffer', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.once('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.getObject.callsArgWith(1, { error: true });
      });
      expect((await store.getFile('key')).toString()).to.equal('');
      expect(s3.getObject.callCount).to.equal(1);
      expect(s3.getObject.firstCall.args[0].Key).to.equal('key');
    });

    it('should load the file contents if it exists', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.once('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.getObject.callsArgWith(1, null, { Body: Buffer.from('thisIsValue') });
      });
      expect((await store.getFile('key')).toString()).to.equal('thisIsValue');
    });
  });
});
