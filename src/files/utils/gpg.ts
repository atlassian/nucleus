import * as cp from 'child-process-promise';
import * as fs from 'fs-extra';
import * as path from 'path';

import { spawnPromiseAndCapture } from './spawn';
import { withTmpDir } from './tmp';
import * as config from '../../config';

export const gpgSign = async (file: string, out: string) => {
  await withTmpDir(async (tmpDir) => {
    const key = path.resolve(tmpDir, 'key.asc');
    await fs.writeFile(key, config.gpgSigningKey);
    const [stdout, stderr] = await spawnPromiseAndCapture('gpg', ['--import', key]);
    try { await fs.remove(out); } catch (err) {}
    const keyImport = stdout.toString() + '--' + stderr.toString();
    const keyMatch = keyImport.match(/ key ([A-Za-z0-9]+):/);
    if (!keyMatch || !keyMatch[1]) {
      console.error(JSON.stringify(keyImport));
      throw new Error('Bad GPG import');
    }
    const keyId = keyMatch[1];
    await cp.spawn('gpg', ['-abs', '--default-key', keyId, '-o', out, file]);
  });
};

export const isGpgKeyValid = async () => {
  if (!config.gpgSigningKey) return false;
  return await withTmpDir(async (tmpDir) => {
    const testFile = path.resolve(tmpDir, 'test_file');
    const outFile = path.resolve(tmpDir, 'out_file');
    await fs.writeFile(testFile, 'foobar');
    try {
      await gpgSign(testFile, outFile);
    } catch (err) {
      return false;
    }
    return await fs.pathExists(outFile);
  });
};
