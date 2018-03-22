import * as cp from 'child-process-promise';
import * as fs from 'fs-extra';
import * as os from 'os';
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

const getTmpDir = async () => {
  let tmpDir = '';
  if (process.platform === 'darwin') {
    await fs.mkdirs(path.resolve('/tmp', 'nucleus'));
    tmpDir = await fs.mkdtemp(path.resolve('/tmp', 'nucleus', 'wd-'));
  } else {
    tmpDir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'nucleus-wd-'));
  }
  return tmpDir;
};

const getCreateRepoCommand = (dir: string, args: string[]) => {
  if (process.platform === 'linux') {
    return ['createrepo', args];
  }
  return [
    'docker',
    ['run', '--rm', '-v', `${dir}:/root`, 'tomologic/createrepo', ...args],
  ];
};

export const initializeYumRepo = async (store: IFileStore, app: NucleusApp, channel: NucleusChannel) => {
  const tmpDir = await getTmpDir();
  await cp.spawn(...getCreateRepoCommand(tmpDir, ['-v', '--no-database', './']), {
    cwd: tmpDir,
  });
  await syncDirectoryToStore(
    store,
    path.posix.join(app.slug, channel.id, 'linux', 'redhat'),
    tmpDir,
  );
  await store.putFile(
    path.posix.join(app.slug, channel.id, 'linux', `${app.slug}.repo`),
    Buffer.from(
`[packages]
name=${app.name} Packages
baseurl=${store.getPublicBaseUrl()}/${app.slug}/${channel.id}/linux/redhat
enabled=1
gpgcheck=0`,
    ),
    true,
  );
};

export const addFileToYumRepo = async (store: IFileStore, app: NucleusApp, channel: NucleusChannel, fileName: string, data: Buffer) => {
  const tmpDir = await getTmpDir();
  const storeKey = path.posix.join(app.slug, channel.id, 'linux', 'redhat');
  await syncStoreToDirectory(
    store,
    storeKey,
    tmpDir,
  );
  await fs.writeFile(path.resolve(tmpDir, fileName), data);
  await cp.spawn(...getCreateRepoCommand(tmpDir, ['-v', '--update', '--no-database', '--deltas', './']), {
    cwd: tmpDir,
  });
  await syncDirectoryToStore(
    store,
    storeKey,
    tmpDir,
  );
};
