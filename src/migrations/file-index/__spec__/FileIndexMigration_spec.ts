import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';

import FileIndexMigration from '../FileIndexMigration';
import LocalStore from '../../../files/local/LocalStore';

const fakeApp = {
  slug: 'app',
  channels: [{
    id: 'channel',
    versions: [{
      name: 'version',
      files: [{
        platform: 'darwin',
        arch: 'x64',
        fileName: 'App.dmg',
      }, {
        platform: 'win32',
        arch: 'ia32',
        fileName: 'App.exe',
      }, {
        platform: 'linux',
        arch: 'x64',
        fileName: 'App.deb',
      }],
    }],
  }],
};

describe('FileIndexMigration', () => {
  let dir: string;
  let store: LocalStore;
  let localConfig: LocalOptions;
  let migrator: FileIndexMigration;
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
    migrator = new FileIndexMigration(store, fakeDriver as any);
  });

  afterEach(async () => {
    await fs.remove(dir);
  });

  describe('getItems', () => {
    it('should return an empty array when there are no files', async () => {
      fakeDriver.getApps.returns(Promise.resolve([]));
      expect(await migrator.getItems()).to.deep.equal([]);
    });
    
    it('should check for existence of index files and mark as done appropriately', async () => {
      fakeDriver.getApps.returns(Promise.resolve([fakeApp]));
      const hasFileStub = stub(store, 'hasFile');
      hasFileStub.onCall(0).returns(Promise.resolve(false));
      hasFileStub.onCall(1).returns(Promise.resolve(true));
      hasFileStub.onCall(2).returns(Promise.resolve(false));
      const items = await migrator.getItems();
      expect(items.length).to.equal(3);
      expect(items[0].done).to.equal(false);
      expect(items[1].done).to.equal(true);
      expect(items[2].done).to.equal(false);
    });

    it('should work for a list of files longer than 5', async () => {
      fakeDriver.getApps.returns(Promise.resolve([fakeApp, fakeApp, fakeApp, fakeApp, fakeApp]));
      const items = await migrator.getItems();
      expect(items.length).to.equal(15);
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

    it('should copy file the file if the item is flagged as not done', async () => {
      const getFile = stub(store, 'getFile');
      getFile.returns(Promise.resolve(Buffer.from('test 123')));
      const putFile = stub(store, 'putFile');
      putFile.returns(Promise.resolve(true));
      await migrator.runOnItem({
        done: false,
        data: {
          originalKey: 'original/key/in/store',
          indexKey: 'index/key/to/move/to',
        },
      });
      expect(getFile.callCount).to.equal(1);
      expect(getFile.firstCall.args[0]).to.equal('original/key/in/store');
      expect(putFile.callCount).to.equal(1);
      expect(putFile.firstCall.args[0]).to.equal('index/key/to/move/to');
      expect(putFile.firstCall.args[1].toString()).to.equal('test 123');
    });
  });
});
