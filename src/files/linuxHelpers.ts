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

const createRepoFile = async (store: IFileStore, app: NucleusApp, channel: NucleusChannel) => {
  await store.putFile(
    path.posix.join(app.slug, channel.id, 'linux', `${app.slug}.repo`),
    Buffer.from(
`[packages]
name=${app.name} Packages
baseurl=${await store.getPublicBaseUrl()}/${app.slug}/${channel.id}/linux/redhat
enabled=1
gpgcheck=0`,
    ),
    true,
  );
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
  await createRepoFile(store, app, channel);
  await fs.remove(tmpDir);
};

export const addFileToYumRepo = async (store: IFileStore, app: NucleusApp, channel: NucleusChannel, fileName: string, data: Buffer, version: string) => {
  const tmpDir = await getTmpDir();
  const storeKey = path.posix.join(app.slug, channel.id, 'linux', 'redhat');
  await syncStoreToDirectory(
    store,
    storeKey,
    tmpDir,
  );
  const binaryPath = path.resolve(tmpDir, `${version}-${fileName}`);
  if (await fs.pathExists(binaryPath)) {
    throw new Error('Uploaded a duplicate file');
  }
  await fs.writeFile(binaryPath, data);
  await cp.spawn(...getCreateRepoCommand(tmpDir, ['-v', '--update', '--no-database', '--deltas', './']), {
    cwd: tmpDir,
  });
  await syncDirectoryToStore(
    store,
    storeKey,
    tmpDir,
  );
  await createRepoFile(store, app, channel);
  await fs.remove(tmpDir);
};

const getScanPackagesCommand = (dir: string, args: string[]): [string, string[]] => {
  if (process.platform === 'linux') {
    return ['dpkg-scanpackages', args];
  }
  return [
    'docker',
    ['run', '--rm', '-v', `${dir}:/root`, 'marshallofsound/dpkg-scanpackages', ...args],
  ];
};

const getScanSourcesCommand = (dir: string, args: string[]): [string, string[]] => {
  if (process.platform === 'linux') {
    return ['dpkg-scansources', args];
  }
  return [
    'docker',
    ['run', '--rm', '-v', `${dir}:/root`, 'marshallofsound/dpkg-scansources', ...args],
  ];
};

const spawnAndGzip = async ([command, args]: [string, string[]], cwd: string): Promise<Buffer> => {
  const result = await cp.spawn(command, args, {
    cwd,
    capture: ['stdout'],
  });
  const output: Buffer = result.stdout;
  const tmpDir = await getTmpDir();
  await fs.writeFile(path.resolve(tmpDir, 'file'), output);
  const gzipResult = await cp.spawn('gzip', [,'-9', 'file'], {
    cwd: tmpDir,
    capture: ['stdout'],
  });
  console.log(tmpDir);
  // await fs.remove(tmpDir);
  // return gzipResult.stdout;
  return await fs.readFile(path.resolve(tmpDir, 'file.gz'));
};

const writeAptMetadata = async (tmpDir: string) => {
  const packagesContent = await spawnAndGzip(getScanPackagesCommand(tmpDir, ['binary', '/dev/null']), tmpDir);
  await fs.writeFile(path.resolve(tmpDir, 'binary', 'Packages.gz'), packagesContent);
  const sourcesContent = await spawnAndGzip(getScanSourcesCommand(tmpDir, ['binary', '/dev/null']), tmpDir);
  await fs.writeFile(path.resolve(tmpDir, 'binary', 'Sources.gz'), sourcesContent);
};

export const initializeAptRepo = async (store: IFileStore, app: NucleusApp, channel: NucleusChannel) => {
  const tmpDir = await getTmpDir();
  await fs.mkdirs(path.resolve(tmpDir, 'binary'));
  await writeAptMetadata(tmpDir);
  await syncDirectoryToStore(
    store,
    path.posix.join(app.slug, channel.id, 'linux', 'debian'),
    tmpDir,
  );
  await fs.remove(tmpDir);
};

export const addFileToAptRepo = async (store: IFileStore, app: NucleusApp, channel: NucleusChannel, fileName: string, data: Buffer, version: string) => {
  const tmpDir = await getTmpDir();
  const storeKey = path.posix.join(app.slug, channel.id, 'linux', 'debian');
  await syncStoreToDirectory(
    store,
    storeKey,
    tmpDir,
  );
  await fs.mkdirs(path.resolve(tmpDir, 'binary'));
  const binaryPath = path.resolve(tmpDir, 'binary', `${version}-${fileName}`);
  if (await fs.pathExists(binaryPath)) {
    throw new Error('Uploaded a duplicate file');
  }
  await fs.writeFile(binaryPath, data);
  await writeAptMetadata(tmpDir);
  await syncDirectoryToStore(
    store,
    storeKey,
    tmpDir,
  );
  await fs.remove(tmpDir);
};
