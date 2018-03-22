import { expect } from 'chai';
import { stub, SinonStub } from 'sinon';

import Positioner from '../Positioner';

const fakeApp: NucleusApp = {
  id: 'fake_id',
  slug: 'fake_slug',
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

describe('Positioner', () => {
  let fakeStore: {
    getFile: SinonStub;
    putFile: SinonStub;
    getPublicBaseUrl: SinonStub;
    deletePath: SinonStub;
  };
  let positioner: Positioner;
  let originalDateToString: SinonStub;
  let lock: string;

  beforeEach(async () => {
    fakeStore = {
      getFile: promiseStub(),
      getPublicBaseUrl: promiseStub(),
      putFile: promiseStub(),
      deletePath: promiseStub(),
    };
    fakeStore.putFile.returns(Promise.resolve(true));
    positioner = new Positioner(fakeStore);
    originalDateToString = stub(Date.prototype, 'toString');
    originalDateToString.returns('MyDate');
    lock = await positioner.getLock(fakeApp);
  });

  afterEach(async () => {
    originalDateToString.restore();
    await positioner.releaseLock(fakeApp, lock);
  });

  it('should not position unknown arches', async () => {
    await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'magicBit', 'win32', 'thing.exe', Buffer.from(''));
    expect(fakeStore.putFile.callCount).to.equal(0);
  });

  it('should not position unknown platfroms', async () => {
    await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'x64', 'chromeOS', 'thing.apk', Buffer.from(''));
    expect(fakeStore.putFile.callCount).to.equal(0);
  });

  describe('windows', () => {
    it('should not position unknown files in the store', async () => {
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'ia32', 'win32', 'thing.wut', Buffer.from(''));
      expect(fakeStore.putFile.callCount).to.equal(0);
    });

    it('should position exe files in arch bucket', async () => {
      const fakeBuffer = Buffer.from('my exe');
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'ia32', 'win32', 'thing.exe', fakeBuffer);
      expect(fakeStore.putFile.callCount).to.equal(1);
      expect(fakeStore.putFile.firstCall.args[0]).to.equal(
        'fake_slug/fake_channel_id/win32/ia32/thing.exe',
      );
      expect(fakeStore.putFile.firstCall.args[1]).to.equal(fakeBuffer);
    });

    it('should position different arches in separate key paths', async () => {
      const firstBuffer = Buffer.from('my exe');
      const secondBuffer = Buffer.from('my other exe');
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'ia32', 'win32', 'thing.exe', firstBuffer);
      expect(fakeStore.putFile.firstCall.args[0]).to.equal(
        'fake_slug/fake_channel_id/win32/ia32/thing.exe',
      );
      expect(fakeStore.putFile.firstCall.args[1]).to.equal(firstBuffer);
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'x64', 'win32', 'thing.exe', secondBuffer);
      expect(fakeStore.putFile.secondCall.args[0]).to.equal(
        'fake_slug/fake_channel_id/win32/x64/thing.exe',
      );
      expect(fakeStore.putFile.secondCall.args[1]).to.equal(secondBuffer);
    });

    it('should position nupkg files in arch bucket', async () => {
      const fakeBuffer = Buffer.from('my nupkg');
      fakeStore.getFile.returns(Promise.resolve(Buffer.from('')));
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'ia32', 'win32', 'thing-full.nupkg', fakeBuffer);
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
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'ia32', 'win32', 'thing-full.nupkg', fakeBuffer);
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
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'ia32', 'win32', 'thing-delta.nupkg', fakeBuffer);
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
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'ia32', 'win32', 'thing-delta.nupkg', fakeBuffer);
      expect(fakeStore.putFile.callCount).to.equal(1);
    });
  });

  describe('darwin', () => {
    it('should not position unknown files in the store', async () => {
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'x64', 'darwin', 'thing.exe', Buffer.from(''));
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'x64', 'darwin', 'thing.lel', Buffer.from(''));
      expect(fakeStore.putFile.callCount).to.equal(0);
    });

    it('should position dmg files in arch bucket', async () => {
      const fakeBuffer = Buffer.from('my dmg');
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'x64', 'darwin', 'thing.dmg', fakeBuffer);
      expect(fakeStore.putFile.callCount).to.equal(1);
      expect(fakeStore.putFile.firstCall.args[0]).to.equal(
        'fake_slug/fake_channel_id/darwin/x64/thing.dmg',
      );
      expect(fakeStore.putFile.firstCall.args[1]).to.equal(fakeBuffer);
    });

    it('should position zip files in arch bucket', async () => {
      const fakeBuffer = Buffer.from('my zip');
      fakeStore.getFile.returns(Promise.resolve(Buffer.from('')));
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'x64', 'darwin', 'thing.zip', fakeBuffer);
      expect(fakeStore.putFile.callCount).to.equal(2);
      expect(fakeStore.putFile.firstCall.args[0]).to.equal(
        'fake_slug/fake_channel_id/darwin/x64/thing.zip',
      );
      expect(fakeStore.putFile.firstCall.args[1]).to.equal(fakeBuffer);
    });

    it('should create a RELEASES.json file if it doesn\'t exist when uploading zips', async () => {
      const fakeBuffer = Buffer.from('my zip');
      fakeStore.getFile.returns(Promise.resolve(Buffer.from('')));
      fakeStore.getPublicBaseUrl.returns('https://foo.bar');
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'x64', 'darwin', 'thing.zip', fakeBuffer);
      expect(fakeStore.putFile.callCount).to.equal(2);
      expect(fakeStore.putFile.secondCall.args[0]).to.equal(
        'fake_slug/fake_channel_id/darwin/x64/RELEASES.json',
      );
      expect(JSON.parse(fakeStore.putFile.secondCall.args[1].toString())).to.deep.equal(v1);
    });

    it('should update the RELEASES.json file if it already exits when uploading zips', async () => {
      const fakeBuffer = Buffer.from('my zip');
      fakeStore.getFile.returns(Promise.resolve(Buffer.from(JSON.stringify(v1))));
      fakeStore.getPublicBaseUrl.returns('https://foo.bar');
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.3', 'x64', 'darwin', 'thing2.zip', fakeBuffer);
      expect(fakeStore.putFile.callCount).to.equal(2);
      expect(fakeStore.putFile.secondCall.args[0]).to.equal(
        'fake_slug/fake_channel_id/darwin/x64/RELEASES.json',
      );
      const expected = Object.assign({}, v1);
      expected.releases = Object.assign([], expected.releases);
      expected.releases.push({
        updateTo: {
          name: '0.0.3',
          version: '0.0.3',
          notes: '',
          pub_date: 'MyDate',
          url: 'https://foo.bar/fake_slug/fake_channel_id/darwin/x64/thing2.zip',
        },
        version: '0.0.3',
      });
      expected.currentRelease = '0.0.3';
      expect(JSON.parse(fakeStore.putFile.secondCall.args[1].toString())).to.deep.equal(expected);
    });

    it('should update not update the "currentRelease" property in the RELEASES.json file if it is higher than the new release', async () => {
      const fakeBuffer = Buffer.from('my zip');
      fakeStore.getFile.returns(Promise.resolve(Buffer.from(JSON.stringify(v1))));
      fakeStore.getPublicBaseUrl.returns('https://foo.bar');
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.1', 'x64', 'darwin', 'thing2.zip', fakeBuffer);
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
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'x64', 'darwin', 'thing2.zip', fakeBuffer);
      expect(fakeStore.putFile.callCount).to.equal(1);
    });

    it('should not update the RELEASES.json file if the version is already in the releases array', async () => {
      const fakeBuffer = Buffer.from('my zip');
      fakeStore.getFile.returns(Promise.resolve(Buffer.from(JSON.stringify(v1))));
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'x64', 'darwin', 'thing2.zip', fakeBuffer);
      expect(fakeStore.putFile.callCount).to.equal(1);
    });
  });

  describe('linux', () => {
    it('should not position any files in the store', async () => {
      await positioner.handleUpload(lock, fakeApp, fakeChannel, '0.0.2', 'ia32', 'linux', 'thing.deb', Buffer.from(''));
      expect(fakeStore.putFile.callCount).to.equal(0);
    });
  });
});
