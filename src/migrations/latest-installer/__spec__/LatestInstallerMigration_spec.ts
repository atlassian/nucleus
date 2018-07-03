import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';

import LatestInstallerMigration from '../LatestInstallerMigration';
import LocalStore from '../../../files/local/LocalStore';

const fakeApp = {
  slug: 'app',
  name: 'App',
  channels: [{
    id: 'channel',
    versions: [{
      name: '0.0.1',
      rollout: 100,
      files: [{
        platform: 'darwin',
        arch: 'x64',
        fileName: 'Foo.pkg',
        type: 'installer',
      }, {
        platform: 'darwin',
        arch: 'x64',
        fileName: 'App1.dmg',
        type: 'installer',
      }],
    }, {
      name: '0.0.2',
      rollout: 100,
      files: [{
        platform: 'darwin',
        arch: 'x64',
        fileName: 'App2.dmg',
        type: 'installer',
      }, {
        platform: 'win32',
        arch: 'ia32',
        fileName: 'App.exe',
        type: 'installer',
      }, {
        platform: 'linux',
        arch: 'x64',
        fileName: 'App.deb',
        type: 'installer',
      }, {
        platform: 'darwin',
        arch: 'x64',
        fileName: 'Test.zip',
        type: 'update',
      }],
    }, {
      name: '0.0.3',
      rollout: 99,
      files: [{
        platform: 'win32',
        arch: 'ia32',
        fileName: 'App3.exe',
        type: 'installer',
      }],
    }],
  }],
};

describe('LatestInstallerMigration', () => {
  let dir: string;
  let store: LocalStore;
  let localConfig: LocalOptions;
  let migrator: LatestInstallerMigration;
  let fakeDriver: {
    getApps: SinonStub;
  };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
    localConfig = {
      root: dir,
      staticUrl: 'https://static.url.com/thing',
    };
    store = new LocalStore(localConfig);
    fakeDriver = {
      getApps: stub(),
    };
    migrator = new LatestInstallerMigration(store, fakeDriver as any);
  });

  afterEach(async () => {
    await fs.remove(dir);
  });

  describe('getItems', () => {
    it('should return an empty array when there are no files', async () => {
      fakeDriver.getApps.returns(Promise.resolve([]));
      expect(await migrator.getItems()).to.deep.equal([]);
    });
    
    it('should check for existence of ref files and mark as done appropriately', async () => {
      fakeDriver.getApps.returns(Promise.resolve([fakeApp]));
      const getFileStub = stub(store, 'getFile');
      getFileStub.returns(Promise.resolve(Buffer.from('0.0.0')));
      getFileStub.onCall(1).returns(Promise.resolve('0.0.2'));
      const items = await migrator.getItems();
      expect(items.length).to.equal(4);
      expect(items[0].done).to.equal(false);
      expect(items[1].done).to.equal(true, 'a file whos latest is already there should be marked as done');
      expect(items[2].done).to.equal(false);
      expect(items[3].done).to.equal(false);
    });

    it('should not use non-100 rollout files', async () => {
      fakeDriver.getApps.returns(Promise.resolve([fakeApp]));
      const getFileStub = stub(store, 'getFile');
      getFileStub.returns(Promise.resolve(Buffer.from('0.0.0')));
      const items = await migrator.getItems();
      expect(items.some(item => item.data.version === '0.0.3')).to.equal(false, 'should not use a non-100 rollout');
    });

    it('should use the latest version of an installer when there are duplicates', async () => {
      fakeDriver.getApps.returns(Promise.resolve([fakeApp]));
      const getFileStub = stub(store, 'getFile');
      getFileStub.returns(Promise.resolve(Buffer.from('0.0.0')));
      const items = await migrator.getItems();
      const dmgItem = items.find(item => item.data.latestKey.endsWith('.dmg'))!;
      expect(dmgItem).to.not.equal(null);
      expect(dmgItem.data).to.have.property('version', '0.0.2');
    });

    it('should not use any update type files', async () => {
      fakeDriver.getApps.returns(Promise.resolve([fakeApp]));
      const getFileStub = stub(store, 'getFile');
      getFileStub.returns(Promise.resolve(Buffer.from('0.0.0')));
      const items = await migrator.getItems();
      const zipItem = items.find(item => item.data.latestKey.endsWith('.zip'));
      expect(zipItem).to.equal(undefined);
    });
  });

  describe('runOnItem', () => {
    it('should do no work if the item is flagged as done', async () => {
      const getFile = stub(store, 'getFile');
      await migrator.runOnItem({
        done: true,
        data: {} as any,
      });
      expect(getFile.callCount).to.equal(0);
    });

    it('should copy index file the latest file if the item is flagged as not done', async () => {
      const getFile = stub(store, 'getFile');
      getFile.returns(Promise.resolve(Buffer.from('test 123')));
      const putFile = stub(store, 'putFile');
      putFile.returns(Promise.resolve(true));
      await migrator.runOnItem({
        done: false,
        data: {
          latestKey: 'latest/key/to/copy/to',
          indexKey: 'index/key/to/copy/from',
          version: '1.0.0',
        },
      });
      expect(getFile.callCount).to.equal(1);
      expect(getFile.firstCall.args[0]).to.equal('index/key/to/copy/from');
      expect(putFile.callCount).to.equal(2);
      expect(putFile.firstCall.args[0]).to.equal('latest/key/to/copy/to');
      expect(putFile.firstCall.args[1].toString()).to.equal('test 123');
      expect(putFile.secondCall.args[0]).to.equal('latest/key/to/copy/to.ref');
      expect(putFile.secondCall.args[1].toString()).to.equal('1.0.0');
    });
  });
});
