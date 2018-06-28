import { expect } from 'chai';
import { stub, SinonStub } from 'sinon';

import Positioner from '../Positioner';

const fakeApp: NucleusApp = {
  id: 'fake_id',
  slug: 'fake_slug',
} as any;
const fakeApp2: NucleusApp = {
  id: 'fake_id_2',
  slug: 'fake_slug_2',
} as any;
const fakeChannel: NucleusChannel = {
  id: 'fake_channel_id',
} as any;

const promiseStub = () => {
  const s = stub();
  s.returns(Promise.resolve());
  return s;
};

const v1 = {
  currentRelease: '0.0.2',
  releases: [{
    updateTo: {
      name: '0.0.2',
      notes: '',
      pub_date: 'MyDate',
      url: 'https://foo.bar/fake_slug/fake_channel_id/darwin/x64/thing.zip',
      version: '0.0.2',
    },
    version: '0.0.2',
  }],
};

const v2 = Object.assign({}, v1);
v2.releases = Object.assign([], v2.releases);
v2.releases.push({
  updateTo: {
    name: '0.0.3',
    version: '0.0.3',
    notes: '',
    pub_date: 'MyDate',
    url: 'https://foo.bar/fake_slug/fake_channel_id/darwin/x64/thing2.zip',
  },
  version: '0.0.3',
});
v2.currentRelease = '0.0.3';

describe('Positioner', () => {
  let fakeStore: {
    getFile: SinonStub;
    putFile: SinonStub;
    getPublicBaseUrl: SinonStub;
    deletePath: SinonStub;
    listFiles: SinonStub;
  };
  let positioner: Positioner;
  let originalDateToString: SinonStub;
  let lock: string;

  beforeEach(async () => {
    fakeStore = {
      getFile: promiseStub().returns(Buffer.from('')),
      getPublicBaseUrl: promiseStub(),
      putFile: promiseStub(),
      deletePath: promiseStub(),
      listFiles: promiseStub().returns([]),
    };
    fakeStore.putFile.returns(Promise.resolve(true));
    positioner = new Positioner(fakeStore);
    originalDateToString = stub(Date.prototype, 'toString');
    originalDateToString.returns('MyDate');
    lock = (await positioner.requestLock(fakeApp))!;
    fakeStore.getFile.onSecondCall().returns(Buffer.from(lock));
    fakeStore.putFile.reset();
    fakeStore.putFile.returns(true);
  });

  afterEach(async () => {
    originalDateToString.restore();
    await positioner.releaseLock(fakeApp, lock);
  });

  it('should not position unknown arches', async () => {
    await positioner.handleUpload(lock, {
      app: fakeApp,
      channel: fakeChannel,
      internalVersion: { name: '0.0.2' } as any,
      file: {
        arch: 'magicBit' as any,
        platform: 'win32',
        fileName: 'thing.exe',
        type: 'installer',
      },
      fileData: Buffer.from(''),
    });
    expect(fakeStore.putFile.callCount).to.equal(0);
  });

  it('should not position unknown platfroms', async () => {
    await positioner.handleUpload(lock, {
      app: fakeApp,
      channel: fakeChannel,
      internalVersion: { name: '0.0.2' } as any,
      file: {
        arch: 'x64',
        platform: 'chromeOS' as any,
        fileName: 'thing.apk',
        type: 'installer',
      },
      fileData: Buffer.from(''),
    });
    expect(fakeStore.putFile.callCount).to.equal(0);
  });

  describe('positioning OS files', () => {
    describe('windows', () => {
      it('should not position unknown files in the store', async () => {
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'ia32',
            platform: 'win32',
            fileName: 'thing.wet',
            type: 'installer',
          },
          fileData: Buffer.from(''),
        });
        expect(fakeStore.putFile.callCount).to.equal(0);
      });

      it('should position exe files in arch bucket', async () => {
        const fakeBuffer = Buffer.from('my exe');
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'ia32',
            platform: 'win32',
            fileName: 'thing.exe',
            type: 'installer',
          },
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(1);
        expect(fakeStore.putFile.firstCall.args[0]).to.equal(
          'fake_slug/fake_channel_id/win32/ia32/thing.exe',
        );
        expect(fakeStore.putFile.firstCall.args[1]).to.equal(fakeBuffer);
      });

      it('should position different arches in separate key paths', async () => {
        const firstBuffer = Buffer.from('my exe');
        const secondBuffer = Buffer.from('my other exe');
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'ia32',
            platform: 'win32',
            fileName: 'thing.exe',
            type: 'installer',
          },
          fileData: firstBuffer,
        });
        expect(fakeStore.putFile.firstCall.args[0]).to.equal(
          'fake_slug/fake_channel_id/win32/ia32/thing.exe',
        );
        expect(fakeStore.putFile.firstCall.args[1]).to.equal(firstBuffer);
        fakeStore.getFile.onCall(2).returns(Buffer.from(lock));
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'x64',
            platform: 'win32',
            fileName: 'thing.exe',
            type: 'installer',
          },
          fileData: secondBuffer,
        });
        expect(fakeStore.putFile.secondCall.args[0]).to.equal(
          'fake_slug/fake_channel_id/win32/x64/thing.exe',
        );
        expect(fakeStore.putFile.secondCall.args[1]).to.equal(secondBuffer);
      });

      it('should position nupkg files in arch bucket', async () => {
        const fakeBuffer = Buffer.from('my nupkg');
        fakeStore.getFile.returns(Promise.resolve(Buffer.from('')));
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'ia32',
            platform: 'win32',
            fileName: 'thing-full.nupkg',
            type: 'update',
          },
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(2);
        expect(fakeStore.putFile.firstCall.args[0]).to.equal(
          'fake_slug/fake_channel_id/win32/ia32/thing-full.nupkg',
        );
        expect(fakeStore.putFile.firstCall.args[1]).to.equal(fakeBuffer);
        expect(fakeStore.putFile.firstCall.args[2]).to.equal(undefined, 'should not override existing release');
      });

      it('should update the RELEASES file with correct hash and filename for all nupkg uploads', async () => {
        const fakeBuffer = Buffer.from('my nupkg');
        fakeStore.getFile.returns(Promise.resolve(Buffer.from('')));
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'ia32',
            platform: 'win32',
            fileName: 'thing-full.nupkg',
            type: 'update',
          },
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(2);
        expect(fakeStore.putFile.secondCall.args[0]).to.equal(
          'fake_slug/fake_channel_id/win32/ia32/RELEASES',
        );
        expect(fakeStore.putFile.secondCall.args[1].toString()).to.equal(
          '0F2320FC3B29E1CD9F989DBF547BCD4D21D3BD12 thing-full.nupkg 8',
        );
        expect(fakeStore.putFile.secondCall.args[2]).to.equal(true, 'should override existing RELEASES');
      });

      it('should append to the existing RELEASES file if available', async () => {
        const fakeBuffer = Buffer.from('my delta nupkg');
        fakeStore.getFile.returns(Promise.resolve(Buffer.from('0F2320FC3B29E1CD9F989DBF547BCD4D21D3BD12 thing-full.nupkg 8')));
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'ia32',
            platform: 'win32',
            fileName: 'thing-delta.nupkg',
            type: 'update',
          },
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(2);
        expect(fakeStore.putFile.secondCall.args[0]).to.equal(
          'fake_slug/fake_channel_id/win32/ia32/RELEASES',
        );
        expect(fakeStore.putFile.secondCall.args[1].toString()).to.equal(
          '0F2320FC3B29E1CD9F989DBF547BCD4D21D3BD12 thing-full.nupkg 8\n' +
          'EF5518DDAF73D40E2A7A31C627702CFFBF59862D thing-delta.nupkg 14',
        );
      });

      it('should not update the RELEASES file if the nupkg is already in the bucket', async () => {
        const fakeBuffer = Buffer.from('my delta nupkg');
        fakeStore.putFile.returns(Promise.resolve(false));
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'ia32',
            platform: 'win32',
            fileName: 'thing-delta.nupkg',
            type: 'update',
          },
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(1);
      });
    });

    describe('darwin', () => {
      before(() => {
        fakeChannel.versions = [];
      });

      beforeEach(() => {
        fakeStore.getPublicBaseUrl.returns('https://foo.bar');
      });

      it('should not position unknown files in the store', async () => {
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'x64',
            platform: 'darwin',
            fileName: 'thing.exe',
            type: 'installer',
          },
          fileData: Buffer.from(''),
        });
        await positioner.handleUpload(lock,{
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'x64',
            platform: 'darwin',
            fileName: 'thing.lel',
            type: 'installer',
          },
          fileData: Buffer.from(''),
        });
        expect(fakeStore.putFile.callCount).to.equal(0);
      });

      it('should position dmg files in arch bucket', async () => {
        const fakeBuffer = Buffer.from('my dmg');
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'x64',
            platform: 'darwin',
            fileName: 'thing.dmg',
            type: 'installer',
          },
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(1);
        expect(fakeStore.putFile.firstCall.args[0]).to.equal(
          'fake_slug/fake_channel_id/darwin/x64/thing.dmg',
        );
        expect(fakeStore.putFile.firstCall.args[1]).to.equal(fakeBuffer);
      });

      it('should position zip files in arch bucket', async () => {
        const fakeBuffer = Buffer.from('my zip');
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'x64',
            platform: 'darwin',
            fileName: 'thing.zip',
            type: 'installer',
          },
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(2);
        expect(fakeStore.putFile.firstCall.args[0]).to.equal(
          'fake_slug/fake_channel_id/darwin/x64/thing.zip',
        );
        expect(fakeStore.putFile.firstCall.args[1]).to.equal(fakeBuffer);
      });

      it('should create a RELEASES.json file if it doesn\'t exist when uploading zips', async () => {
        const fakeBuffer = Buffer.from('my zip');
        const file: NucleusFile = {
          arch: 'x64',
          platform: 'darwin',
          fileName: 'thing.zip',
          type: 'installer',
        };
        fakeChannel.versions.push({
          name: '0.0.2',
          files: [file],
        } as any);
        await positioner.handleUpload(lock, {
          file,
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(2);
        expect(fakeStore.putFile.secondCall.args[0]).to.equal(
          'fake_slug/fake_channel_id/darwin/x64/RELEASES.json',
        );
        expect(JSON.parse(fakeStore.putFile.secondCall.args[1].toString())).to.deep.equal(v1);
      });

      it('should update the RELEASES.json file if it already exits when uploading zips', async () => {
        const fakeBuffer = Buffer.from('my zip');
        fakeStore.getPublicBaseUrl.returns('https://foo.bar');
        const file1: NucleusFile = {
          arch: 'x64',
          platform: 'darwin',
          fileName: 'thing2.zip',
          type: 'installer',
        };
        fakeChannel.versions.push({
          name: '0.0.3',
          files: [file1],
        } as any);
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.3' } as any,
          file: file1,
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(2);
        expect(fakeStore.putFile.secondCall.args[0]).to.equal(
          'fake_slug/fake_channel_id/darwin/x64/RELEASES.json',
        );
        expect(JSON.parse(fakeStore.putFile.secondCall.args[1].toString())).to.deep.equal(v2);
      });

      it('should update the RELEASES.json file even if the version is already in the releases array but not use the new file', async () => {
        const fakeBuffer = Buffer.from('my zip');
        const file: NucleusFile = {
          arch: 'x64',
          platform: 'darwin',
          fileName: 'thing3.zip',
          type: 'installer',
        };
        fakeChannel.versions[0].files.push(file);
        await positioner.handleUpload(lock, {
          file,
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(2);
        expect(JSON.parse(fakeStore.putFile.secondCall.args[1].toString())).to.deep.equal(v2);
      });

      it('should not update the "currentRelease" property in the RELEASES.json file if it is higher than the new release', async () => {
        const fakeBuffer = Buffer.from('my zip');
        fakeStore.getPublicBaseUrl.returns('https://foo.bar');
        const file: NucleusFile = {
          arch: 'x64',
          platform: 'darwin',
          fileName: 'thing2.zip',
          type: 'installer',
        };
        // Replace 0.0.3
        fakeChannel.versions[1] = {
          name: '0.0.1',
          files: [file],
        } as any;
        await positioner.handleUpload(lock, {
          file,
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.1' } as any,
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(2);
        expect(fakeStore.putFile.secondCall.args[0]).to.equal(
          'fake_slug/fake_channel_id/darwin/x64/RELEASES.json',
        );
        const expected = Object.assign({}, v1);
        expected.releases = Object.assign([], expected.releases);
        expected.releases.push({
          updateTo: {
            name: '0.0.1',
            version: '0.0.1',
            notes: '',
            pub_date: 'MyDate',
            url: 'https://foo.bar/fake_slug/fake_channel_id/darwin/x64/thing2.zip',
          },
          version: '0.0.1',
        });
        expect(JSON.parse(fakeStore.putFile.secondCall.args[1].toString())).to.deep.equal(expected);
      });

      it('should not update the RELEASES.json file if the zip already existed on the bucket', async () => {
        const fakeBuffer = Buffer.from('my zip');
        fakeStore.putFile.returns(Promise.resolve(false));
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'x64',
            platform: 'darwin',
            fileName: 'thing2.zip',
            type: 'installer',
          },
          fileData: fakeBuffer,
        });
        expect(fakeStore.putFile.callCount).to.equal(1);
      });
    });

    describe('linux', () => {
      // FIXME(MarshallOfSound): Test the linuxHelpers and remove this test
      it.skip('should not position any files in the store', async () => {
        await positioner.handleUpload(lock, {
          app: fakeApp,
          channel: fakeChannel,
          internalVersion: { name: '0.0.2' } as any,
          file: {
            arch: 'ia32',
            platform: 'linux',
            fileName: 'thing.dev',
            type: 'installer',
          },
          fileData: Buffer.from(''),
        });
        expect(fakeStore.putFile.callCount).to.equal(0);
      });
    });
  });

  describe('locking', () => {
    beforeEach(() => {
      const files: {
        [key: string]: Buffer;
      } = {};
      Object.assign(fakeStore, {
        getFile: async (key: string) => {
          return files[key] || Buffer.from('');
        },
        putFile: async (key: string, data: Buffer, overwriteExisting?: boolean) => {
          if (!files[key] || overwriteExisting) {
            files[key] = data;
          }
        },
        deletePath: async (key: string) => {
          delete files[key];
        },
      });
    });

    it('should obtain the lock when nothing has claimed it', async () => {
      expect(await positioner.requestLock(fakeApp)).to.not.equal(null);
    });

    it('should obtain two locks for different apps simultaneously', async () => {
      expect(await positioner.requestLock(fakeApp)).to.not.equal(null);
      expect(await positioner.requestLock(fakeApp2)).to.not.equal(null);
    });

    it('should not issue two locks for the same app simultaneously', async () => {
      expect(await positioner.requestLock(fakeApp)).to.not.equal(null);
      expect(await positioner.requestLock(fakeApp)).to.equal(null);
    });

    it('should issue two locks for the same app sequentially', async () => {
      const lock = (await positioner.requestLock(fakeApp))!;
      expect(lock).to.not.equal(null);
      await positioner.releaseLock(fakeApp, lock);
      const secondLock = await positioner.requestLock(fakeApp);
      expect(secondLock).to.not.equal(null);
      expect(lock).to.not.equal(secondLock, 'locks should be unique');
    });

    it('should not release a lock if the existing lock is not provided', async () => {
      const lock = (await positioner.requestLock(fakeApp))!;
      await positioner.releaseLock(fakeApp, 'this-is-not-the-lock');
      expect(await positioner.requestLock(fakeApp)).to.equal(null);
      await positioner.releaseLock(fakeApp, lock);
      expect(await positioner.requestLock(fakeApp)).to.not.equal(null);
    });
  });
});
