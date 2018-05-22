import * as fs from 'fs-extra';
import * as path from 'path';

export const syncDirectoryToStore = async (store: IFileStore, keyPrefix: string, localBaseDir: string, relative: string = '.') => {
  for (const child of await fs.readdir(path.resolve(localBaseDir, relative))) {
    const absoluteChild = path.resolve(localBaseDir, relative, child);
    if ((await fs.stat(absoluteChild)).isDirectory()) {
      await syncDirectoryToStore(store, keyPrefix, localBaseDir, path.join(relative, child));
    } else {
      await store.putFile(
        path.posix.join(keyPrefix, relative, child),
        await fs.readFile(absoluteChild),
        true,
      );
    }
  }
};

export const syncStoreToDirectory = async (store: IFileStore, keyPrefix: string, localDir: string) => {
  for (const key of await store.listFiles(keyPrefix)) {
    const relativeKey = key.substr(keyPrefix.length + 1);
    const localPath = path.resolve(localDir, relativeKey);
    await fs.mkdirs(path.dirname(localPath));
    await fs.writeFile(
      localPath,
      await store.getFile(key),
    );
  }
};
