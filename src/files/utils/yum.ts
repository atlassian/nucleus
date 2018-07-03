import * as cp from 'child-process-promise';
import * as fs from 'fs-extra';
import * as path from 'path';

import { spawnPromiseAndCapture, escapeShellArguments } from './spawn';
import { syncDirectoryToStore, syncStoreToDirectory } from './sync';
import { withTmpDir } from './tmp';
import * as config from '../../config';

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
  const safeArgs = escapeShellArguments(args);
  return [
    'docker',
    ['run', '--rm', '-v', `${dir}:/root/working`, 'marshallofsound/sh', `(gpg-agent --daemon) && (gpg --import key.asc || true) && (rpmsign ${safeArgs.join(' ')})`],
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
  await withTmpDir(async (tmpDir) => {
    const fileName = path.basename(rpm);
    const tmpFile = path.resolve(tmpDir, fileName);
    await fs.copy(rpm, tmpFile);
    // Import GPG key
    const key = path.resolve(tmpDir, 'key.asc');
    await fs.writeFile(key, config.gpgSigningKey);
    const [stdout, stderr] = await spawnPromiseAndCapture('gpg', ['--import', key]);

    const keyImport = stdout.toString() + '--' + stderr.toString();
    const keyMatch = keyImport.match(/ key ([A-Za-z0-9]+):/);
    if (!keyMatch || !keyMatch[1]) {
      console.error(JSON.stringify(keyImport));
      throw new Error('Bad GPG import');
    }
    const keyId = keyMatch[1];
    // Sign the RPM file
    const [exe, args] = getSignRpmCommand(tmpDir, ['-D', `_gpg_name ${keyId}`, '--addsign', path.basename(rpm)]);
    const [signOut, signErr, signError] = await spawnPromiseAndCapture(exe, args, {
      cwd: tmpDir,
    });
    if (signError) {
      console.error('Failed to sign RPM file');
      console.error(`Output:\n${signOut.toString()}\n\n${signErr.toString()}`);
      throw signError;
    }
    // Done signing
    await fs.copy(tmpFile, rpm, {
      overwrite: true,
    });
  });
};

const signAllRpmFiles = async (dir: string) => {
  const rpmFiles = (await fs.readdir(dir))
    .filter(file => file.endsWith('.rpm'))
    .map(file => path.resolve(dir, file));
  for (const rpm of rpmFiles) {
    await signRpm(rpm);
  }
};

export const initializeYumRepo = async (store: IFileStore, app: NucleusApp, channel: NucleusChannel) => {
  await withTmpDir(async (tmpDir) => {
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
  });
};

export const addFileToYumRepo = async (store: IFileStore, {
  app,
  channel,
  internalVersion,
  file,
  fileData,
}: HandlePlatformUploadOpts) => {
  await withTmpDir(async (tmpDir) => {
    const storeKey = path.posix.join(app.slug, channel.id, 'linux', 'redhat');
    await syncStoreToDirectory(
      store,
      storeKey,
      tmpDir,
    );
    const binaryPath = path.resolve(tmpDir, `${internalVersion.name}-${file.fileName}`);
    if (await fs.pathExists(binaryPath)) {
      throw new Error('Uploaded a duplicate file');
    }
    await fs.writeFile(binaryPath, fileData);
    await signAllRpmFiles(tmpDir);
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
  });
};
