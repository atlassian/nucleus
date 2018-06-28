import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import LocalStore from '../local/LocalStore';

describe('LocalStore', () => {
  let dir: string;
  let store: LocalStore;
  let localConfig: LocalOptions;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), '/'));
    localConfig = {
      root: dir,
      staticUrl: 'https://static.url.com/thing',
    };
    store = new LocalStore(localConfig);
  });

  afterEach(async () => {
    await fs.remove(dir);
  });

  describe('getPublicBaseUrl', () => {
    it('should return the staticUrl config property', async () => {
      expect(await store.getPublicBaseUrl()).to.equal('https://static.url.com/thing');
    });
  });

  describe('putFile', () => {
    it('should write files to the correct directory', async () => {
      await store.putFile('key', Buffer.from('value'));
      expect(await fs.readFile(path.resolve(dir, 'key'), 'utf8')).to.equal('value');
    });

    it('should not overwrite files by default', async () => {
      expect(await store.putFile('key', Buffer.from('value'))).to.equal(true);
      expect(await fs.readFile(path.resolve(dir, 'key'), 'utf8')).to.equal('value');
      expect(await store.putFile('key', Buffer.from('value2'))).to.equal(false);
      expect(await fs.readFile(path.resolve(dir, 'key'), 'utf8')).to.equal('value');
    });

    it('should overwrite files when overwrite = true', async () => {
      expect(await store.putFile('key', Buffer.from('value'))).to.equal(true);
      expect(await fs.readFile(path.resolve(dir, 'key'), 'utf8')).to.equal('value');
      expect(await store.putFile('key', Buffer.from('value2'), true)).to.equal(true);
      expect(await fs.readFile(path.resolve(dir, 'key'), 'utf8')).to.equal('value2');
    });

    it('should write to deep keys', async () => {
      expect(await store.putFile('key/goes/super/duper/deep', Buffer.from('deepValue'))).to.equal(true);
      expect(await fs.readFile(
        path.resolve(dir, 'key', 'goes', 'super', 'duper', 'deep'),
        'utf8',
      )).to.equal('deepValue');
    });
  });

  describe('getFile', () => {
    it('should default to empty string buffer', async () => {
      expect((await store.getFile('key')).toString()).to.equal('');
    });

    it('should load the file contents if it exists', async () => {
      await store.putFile('key', Buffer.from('existing'));
      expect((await store.getFile('key')).toString()).to.equal('existing');
    });
  });

  describe('hasFile', () => {
    it('should return true when the file exists', async () => {
      await store.putFile('key', Buffer.from(''));
      expect(await store.hasFile('key')).to.equal(true);
    });

    it('should return false when the file does not exist', async () => {
      expect(await store.hasFile('key')).to.equal(false);
    });

    it('should return false when the path exists but is not a file', async () => {
      await store.putFile('dir/key', Buffer.from(''));
      expect(await store.hasFile('dir')).to.equal(false);
    });
  });
});
