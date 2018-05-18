import * as cp from 'child-process-promise';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

import * as config from '../config';

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

const getCreateRepoCommand = (dir: string, args: string[]): [string, string[]] => {
  if (process.platform === 'linux') {
    return ['createrepo', args];
  }
  return [
    'docker',
    ['run', '--rm', '-v', `${dir}:/root`, 'tomologic/createrepo', ...args],
  ];
};

const getSignRpmCommand = (dir: string, args: string[]): [string, string[]] => {
  if (process.platform === 'linux') {
    return ['rpmsign', args];
  }
  return [
    'docker',
    ['run', '--rm', '-v', `${dir}:/root/working`, 'marshallofsound/sh', `(gpg-agent --daemon) && (gpg --import key.asc || true) && (rpmsign ${args.join(' ')})`],
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
gpgcheck=1`,
    ),
    true,
  );
};

const signRpm = async (rpm: string) => {
  const tmpDir = await getTmpDir();
  const fileName = path.basename(rpm);
  const tmpFile = path.resolve(tmpDir, fileName);
  await fs.copy(rpm, tmpFile);
  // Import GPG key
  const key = path.resolve(tmpDir, 'key.asc');
  await fs.writeFile(key, config.gpgSigningKey);
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  const child = cp.spawn('gpg', ['--import', key]);
  child.childProcess.stdout.on('data', (data: Buffer) => stdout.push(data));
  child.childProcess.stderr.on('data', (data: Buffer) => stderr.push(data));
  try {
    await child;
  } catch (err) {
    // Ignore for now
  }
  await fs.remove(tmpDir);
  const keyImport = Buffer.concat(stdout).toString() + '--' + Buffer.concat(stderr).toString();
  const keyMatch = keyImport.match(/ key ([A-Za-z0-9]+):/);
  if (!keyMatch || !keyMatch[1]) {
    console.error(JSON.stringify(keyImport));
    throw new Error('Bad GPG import');
  }
  const keyId = keyMatch[1];
  // Sign the RPM file
  const [exe, args] = getSignRpmCommand(tmpDir, ['-D', `"_gpg_name ${keyId}"`, '--addsign', path.basename(rpm)]);
  await cp.spawn(exe, args, {
    cwd: tmpDir,
    capture: ['stdout'],
  });
  // Done signing
  await fs.copy(tmpFile, rpm, {
    overwrite: true,
  });
  await fs.remove(tmpDir);
};

const signAllRpms = async (dir: string) => {
  const rpms = (await fs.readdir(dir))
    .filter(file => file.endsWith('.rpm'))
    .map(file => path.resolve(dir, file));
  for (const rpm of rpms) {
    await signRpm(rpm);
  }
};

export const initializeYumRepo = async (store: IFileStore, app: NucleusApp, channel: NucleusChannel) => {
  const tmpDir = await getTmpDir();
  const [exe, args] = getCreateRepoCommand(tmpDir, ['-v', '--no-database', './']);
  await cp.spawn(exe, args, {
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
  await signAllRpms(tmpDir);
  const [exe, args] = getCreateRepoCommand(tmpDir, ['-v', '--update', '--no-database', '--deltas', './']);
  await cp.spawn(exe, args, {
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

const spawnAndGzip = async ([command, args]: [string, string[]], cwd: string): Promise<[Buffer, Buffer]> => {
  const result = await cp.spawn(command, args, {
    cwd,
    capture: ['stdout'],
  });
  const output: Buffer = result.stdout;
  const tmpDir = await getTmpDir();
  await fs.writeFile(path.resolve(tmpDir, 'file'), output);
  await cp.spawn('gzip', ['-9', 'file'], {
    cwd: tmpDir,
    capture: ['stdout'],
  });
  const content = await fs.readFile(path.resolve(tmpDir, 'file.gz'));
  await fs.remove(tmpDir);
  return [output, content];
};

const getAptFtpArchiveCommand = (dir: string, args: string[]): [string, string[]] => {
  if (process.platform === 'linux') {
    return ['apt-ftparchive', args];
  }
  return [
    'docker',
    ['run', '--rm', '-v', `${dir}:/root`, 'marshallofsound/apt-ftparchive', ...args],
  ];
};

const gpgSign = async (file: string, out: string) => {
  const tmpDir = await getTmpDir();
  const key = path.resolve(tmpDir, 'key.asc');
  await fs.writeFile(key, config.gpgSigningKey);
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  const child = cp.spawn('gpg', ['--import', key]);
  child.childProcess.stdout.on('data', (data: Buffer) => stdout.push(data));
  child.childProcess.stderr.on('data', (data: Buffer) => stderr.push(data));
  try {
    await child;
  } catch (err) {
    // Ignore for now
  }
  await fs.remove(tmpDir);
  try { await fs.remove(out); } catch (err) {}
  const keyImport = Buffer.concat(stdout).toString() + '--' + Buffer.concat(stderr).toString();
  const keyMatch = keyImport.match(/ key ([A-Za-z0-9]+):/);
  if (!keyMatch || !keyMatch[1]) {
    console.error(JSON.stringify(keyImport));
    throw new Error('Bad GPG import');
  }
  const keyId = keyMatch[1];
  await cp.spawn('gpg', ['-abs', '--default-key', keyId, '-o', out, file]);
};

export const isGpgKeyValid = async () => {
  if (!config.gpgSigningKey) return false;
  const tmpDir = await getTmpDir();
  const testFile = path.resolve(tmpDir, 'test_file');
  const outFile = path.resolve(tmpDir, 'out_file');
  await fs.writeFile(testFile, 'foobar');
  try {
    await gpgSign(testFile, outFile);
  } catch (err) {
    await fs.remove(tmpDir);
    return false;
  }
  const createdFile = await fs.pathExists(outFile);
  await fs.remove(tmpDir);
  return createdFile;
};

const generateReleaseFile = async (tmpDir: string, app: NucleusApp) => {
  const configFile = path.resolve(tmpDir, 'Release.conf');
  await fs.writeFile(configFile, `APT::FTPArchive::Release::Origin "${config.organization || 'Nucleus'}";
APT::FTPArchive::Release::Label "${app.name}";
APT::FTPArchive::Release::Suite "stable";
APT::FTPArchive::Release::Codename "debian";
APT::FTPArchive::Release::Architectures "i386 amd64";
APT::FTPArchive::Release::Components "main";
APT::FTPArchive::Release::Description "${app.name}";`);
  const [exe, args] = getAptFtpArchiveCommand(tmpDir, ['-c=Release.conf', 'release', '.']);
  const { stdout } = await cp.spawn(exe, args, {
    cwd: path.resolve(tmpDir),
    capture: ['stdout', 'stderr'],
  });
  await fs.writeFile(path.resolve(tmpDir, 'Release'), stdout);
  await gpgSign(path.resolve(tmpDir, 'Release'), path.resolve(tmpDir, 'Release.gpg'));
  await fs.remove(configFile);
};

const writeAptMetadata = async (tmpDir: string, app: NucleusApp) => {
  const packagesContent = await spawnAndGzip(getScanPackagesCommand(tmpDir, ['binary', '/dev/null']), tmpDir);
  await fs.writeFile(path.resolve(tmpDir, 'binary', 'Packages'), packagesContent[0]);
  await fs.writeFile(path.resolve(tmpDir, 'binary', 'Packages.gz'), packagesContent[1]);
  const sourcesContent = await spawnAndGzip(getScanSourcesCommand(tmpDir, ['binary', '/dev/null']), tmpDir);
  await fs.writeFile(path.resolve(tmpDir, 'binary', 'Sources'), sourcesContent[0]);
  await fs.writeFile(path.resolve(tmpDir, 'binary', 'Sources.gz'), sourcesContent[1]);
  await generateReleaseFile(path.resolve(tmpDir, 'binary'), app);
};

export const initializeAptRepo = async (store: IFileStore, app: NucleusApp, channel: NucleusChannel) => {
  const tmpDir = await getTmpDir();
  await fs.mkdirs(path.resolve(tmpDir, 'binary'));
  await writeAptMetadata(tmpDir, app);
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
  await writeAptMetadata(tmpDir, app);
  await syncDirectoryToStore(
    store,
    storeKey,
    tmpDir,
  );
  await fs.remove(tmpDir);
};
