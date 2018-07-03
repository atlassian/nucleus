import { expect } from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';

import { withTmpDir } from '../tmp';

describe('withTmpDir', () => {
  it('should create an empty directory', async () => {
    await withTmpDir(async (tmpDir: string) => {
      expect(tmpDir).to.not.equal(null);
      expect(tmpDir).to.be.a('string');
      expect(await fs.pathExists(tmpDir)).to.equal(true);
      expect(await fs.readdir(tmpDir)).to.have.lengthOf(0);
    });
  });

  it('should delete the directory after the async fn resolves', async () => {
    let tmp: string;
    await withTmpDir(async (tmpDir: string) => {
      tmp = tmpDir;
      await fs.writeFile(path.resolve(tmpDir, 'foo'), 'bar');
    });
    expect(await fs.pathExists(tmp!)).to.equal(false);
  });

  it('should delete the directory after the async fn rejects', async () => {
    let tmp: string;
    let threw = false;
    try {
      await withTmpDir(async (tmpDir: string) => {
        tmp = tmpDir;
        throw 'foo';
      });
    } catch (err) {
      expect(err).to.equal('foo');
      threw = true;
    }
    expect(threw).to.equal(true);
    expect(await fs.pathExists(tmp!)).to.equal(false);
  });

  it('should return the value returned from the inner async fn', async () => {
    const returnValue = await withTmpDir(async () => {
      return 1;
    });
    expect(returnValue).to.equal(1);
  });

  it('should not throw if the tmp dir is cleaned up internally', async () => {
    await withTmpDir(async (tmpDir) => {
      await fs.remove(tmpDir);
    });
  });
});
