import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

export const withTmpDir = async <T>(fn: (tmpDir: string) => Promise<T>) => {
  let createdDir = '';
  if (process.platform === 'darwin') {
    await fs.mkdirs(path.resolve('/tmp', 'nucleus'));
    createdDir = await fs.mkdtemp(path.resolve('/tmp', 'nucleus', 'wd-'));
  } else {
    createdDir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'nucleus-wd-'));
  }
  const cleanup = async () => {
    if (await fs.pathExists(createdDir)) {
      await fs.remove(createdDir);
    }
  };
  let result: T;
  try {
    result = await fn(createdDir);
  } catch (err) {
    await cleanup();
    throw err;
  }
  await cleanup();
  return result;
};
