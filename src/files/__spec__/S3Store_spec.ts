import * as AWS from 'aws-sdk';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import { stub, SinonStubbedInstance } from 'sinon';

import { CloudFrontBatchInvalidator } from '../s3/CloudFrontBatchInvalidator';
import S3Store from '../s3/S3Store';

describe('S3Store', () => {
  let store: S3Store;
  let S3: typeof AWS.S3;
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
      s3Watcher.on('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        if (!s3) s3 = instance;
        instance.headObject.callsArgWith(1, { code: 'NotFound' });
        instance.putObject.callsArgWith(1, null);
      });
      expect(await store.putFile('myKey', Buffer.from('value'))).to.equal(true);
      expect(s3!.putObject.callCount).to.equal(1);
      expect(s3!.putObject.firstCall.args[0]).to.have.property('Key', 'myKey');
    });

    it('should not overwrite files by default', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.on('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.headObject.callsArgWith(1, null);
        instance.putObject.callsArgWith(1, null);
      });
      expect(await store.putFile('myKey', Buffer.from('value'))).to.equal(false);
      expect(s3!.putObject.callCount).to.equal(0);
    });

    it('should overwrite files when overwrite = true', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.on('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.headObject.callsArgWith(1, null);
        instance.putObject.callsArgWith(1, null);
      });
      expect(await store.putFile('myKey', Buffer.from('value'), true)).to.equal(true);
      expect(s3!.putObject.callCount).to.equal(1);
    });

    it('should put objects with appropriate read config', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.on('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.headObject.callsArgWith(1, null);
        instance.putObject.callsArgWith(1, null);
      });
      expect(await store.putFile('myKey', Buffer.from('value'), true)).to.equal(true);
      expect(s3!.putObject.callCount).to.equal(1);
      expect(s3!.putObject.firstCall.args[0]).to.deep.equal({
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
      s3Watcher.on('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        instance.headObject.callsArgWith(1, null);
        instance.putObject.callsArgWith(1, null);
      });
      let cf: SinonStubbedInstance<AWS.CloudFront>;
      cloudFrontWatcher.on('new', (instance: SinonStubbedInstance<AWS.CloudFront>) => {
        cf = instance;
        cf.createInvalidation.callsArgWith(1, null);
      });
      expect(await store.putFile('myKey', Buffer.from('value'), true)).to.equal(true);
      expect(cf!).to.equal(undefined);
      clearTimeout(CloudFrontBatchInvalidator.get(store).nextTimer);
      (CloudFrontBatchInvalidator.get(store) as any).lastAdd = 0;
      CloudFrontBatchInvalidator.get(store).runJob();
      expect(cf!.createInvalidation.callCount).to.equal(1);
      const invalidateOptions = cf!.createInvalidation.firstCall.args[0];
      expect(invalidateOptions).to.have.property('DistributionId', '0id');
      expect(invalidateOptions.InvalidationBatch.Paths.Quantity).to.equal(1);
      expect(invalidateOptions.InvalidationBatch.Paths.Items).to.deep.equal(['/myKey']);
      delete s3Config.cloudfront;
    });

    it('should batch cloudFront invalidations if cloudFront settings are set', async () => {
      s3Config.cloudfront = {
        distributionId: '0id',
        publicUrl: 'https://this.is.custom/lel',
      };
      s3Watcher.on('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        instance.headObject.callsArgWith(1, null);
        instance.putObject.callsArgWith(1, null);
      });
      let cf: SinonStubbedInstance<AWS.CloudFront>;
      cloudFrontWatcher.on('new', (instance: SinonStubbedInstance<AWS.CloudFront>) => {
        cf = instance;
        cf.createInvalidation.callsArgWith(1, null);
      });
      expect(await store.putFile('myKey', Buffer.from('value'), true)).to.equal(true);
      expect(await store.putFile('myKey2', Buffer.from('value2'), true)).to.equal(true);
      expect(cf!).to.equal(undefined);
      clearTimeout(CloudFrontBatchInvalidator.get(store).nextTimer);
      (CloudFrontBatchInvalidator.get(store) as any).lastAdd = 0;
      CloudFrontBatchInvalidator.get(store).runJob();
      expect(cf!.createInvalidation.callCount).to.equal(1);
      const invalidateOptions = cf!.createInvalidation.firstCall.args[0];
      expect(invalidateOptions).to.have.property('DistributionId', '0id');
      expect(invalidateOptions.InvalidationBatch.Paths.Quantity).to.equal(2);
      expect(invalidateOptions.InvalidationBatch.Paths.Items).to.deep.equal(['/myKey', '/myKey2']);
      delete s3Config.cloudfront;
    });

    it('should stack cloudFront invalidations on failure', async () => {
      s3Config.cloudfront = {
        distributionId: '0id',
        publicUrl: 'https://this.is.custom/lel',
      };
      s3Watcher.on('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        instance.headObject.callsArgWith(1, null);
        instance.putObject.callsArgWith(1, null);
      });
      let cf: SinonStubbedInstance<AWS.CloudFront>;
      let count = 0;
      cloudFrontWatcher.on('new', (instance: SinonStubbedInstance<AWS.CloudFront>) => {
        cf = instance;
        count += 1;
        cf.createInvalidation.onFirstCall().callsArgWith(1, count === 1 ? 'Error' : null);
      });
      expect(await store.putFile('myKey', Buffer.from('value'), true)).to.equal(true);
      expect(await store.putFile('myKey2', Buffer.from('value2'), true)).to.equal(true);
      expect(cf!).to.equal(undefined);
      clearTimeout(CloudFrontBatchInvalidator.get(store).nextTimer);
      (CloudFrontBatchInvalidator.get(store) as any).lastAdd = 0;
      CloudFrontBatchInvalidator.get(store).runJob();
      clearTimeout(CloudFrontBatchInvalidator.get(store).nextTimer);
      expect(cf!.createInvalidation.callCount).to.equal(1);
      const invalidateOptions = cf!.createInvalidation.firstCall.args[0];
      expect(invalidateOptions).to.have.property('DistributionId', '0id');
      expect(invalidateOptions.InvalidationBatch.Paths.Quantity).to.equal(2);
      expect(invalidateOptions.InvalidationBatch.Paths.Items).to.deep.equal(['/myKey', '/myKey2']);
      expect(await store.putFile('myKey3', Buffer.from('value3'), true)).to.equal(true);
      clearTimeout(CloudFrontBatchInvalidator.get(store).nextTimer);
      (CloudFrontBatchInvalidator.get(store) as any).lastAdd = 0;
      CloudFrontBatchInvalidator.get(store).runJob();
      clearTimeout(CloudFrontBatchInvalidator.get(store).nextTimer);
      expect(count).to.equal(2);
      const invalidateOptions2 = cf!.createInvalidation.firstCall.args[0];
      expect(invalidateOptions2.InvalidationBatch.Paths.Quantity).to.equal(3);
      expect(invalidateOptions2.InvalidationBatch.Paths.Items).to.deep.equal(['/myKey', '/myKey2', '/myKey3']);
      delete s3Config.cloudfront;
    });
  });

  describe('getFile', () => {
    it('should default to empty string buffer', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.on('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.getObject.callsArgWith(1, { error: true });
      });
      expect((await store.getFile('key')).toString()).to.equal('');
      expect(s3!.getObject.callCount).to.equal(1);
      expect(s3!.getObject.firstCall.args[0].Key).to.equal('key');
    });

    it('should load the file contents if it exists', async () => {
      s3Watcher.on('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        instance.getObject.callsArgWith(1, null, { Body: Buffer.from('thisIsValue') });
      });
      expect((await store.getFile('key')).toString()).to.equal('thisIsValue');
    });
  });

  describe('hasFile', () => {
    it('should return true when headObject resolves', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.on('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.headObject.callsArgWith(1, null);
      });
      expect(await store.hasFile('myKey')).to.equal(true);
      expect(s3!.headObject.callCount).to.equal(1);
    });

    it('should return false when headObject calls back with an error', async () => {
      let s3: SinonStubbedInstance<AWS.S3>;
      s3Watcher.on('new', (instance: SinonStubbedInstance<AWS.S3>) => {
        s3 = instance;
        instance.headObject.callsArgWith(1, { code: 'NotFound' });
      });
      expect(await store.hasFile('myKey')).to.equal(false);
      expect(s3!.headObject.callCount).to.equal(1);
    });
  });
});
