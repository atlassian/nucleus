import * as cp from 'child-process-promise';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as semver from 'semver';

import { gpgSign, gpgSignInline } from './gpg';
import { syncDirectoryToStore } from './sync';
import { withTmpDir } from './tmp';
import * as config from '../../config';

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
  return await withTmpDir(async (tmpDir: string) => {
    await fs.writeFile(path.resolve(tmpDir, 'file'), output);
    await cp.spawn('gzip', ['-9', 'file'], {
      cwd: tmpDir,
      capture: ['stdout'],
    });
    const content = await fs.readFile(path.resolve(tmpDir, 'file.gz'));
    return [output, content] as [Buffer, Buffer];
  });
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
  await gpgSignInline(path.resolve(tmpDir, 'Release'), path.resolve(tmpDir, 'InRelease'));
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
  await withTmpDir(async (tmpDir) => {
    await fs.mkdirs(path.resolve(tmpDir, 'binary'));
    await writeAptMetadata(tmpDir, app);
    await syncDirectoryToStore(
      store,
      path.posix.join(app.slug, channel.id, 'linux', 'debian'),
      tmpDir,
    );
  });
};

export const addFileToAptRepo = async (store: IFileStore, {
  app,
  channel,
  internalVersion,
  file,
  fileData,
}: HandlePlatformUploadOpts) => {
  await withTmpDir(async (tmpDir) => {
    const storeKey = path.posix.join(app.slug, channel.id, 'linux', 'debian');
    await fs.mkdirs(path.resolve(tmpDir, 'binary'));

    // Find the latest Version for which we have a .deb File
    let latestVersion;
    let latestVersionFile;
    for (const version of channel.versions) {
      if (!version.dead && (!latestVersion || semver.gt(version.name, latestVersion.name))) {
        const versionFile = (version.files || []).find((f) => f.fileName.endsWith(".deb") && f.platform === "linux");
        if (versionFile) {
          latestVersion = version;
          latestVersionFile = versionFile;
        }
      }
    }
    if (latestVersion && latestVersionFile && internalVersion.name !== latestVersion.name) {
      // There's a newer version than the one we're uploading (rare!). Download that .deb.
      const fname = `${latestVersion.name}-${latestVersionFile.fileName}`;
      await fs.writeFile(`${tmpDir}/binary/${fname}`, await store.getFile(`${storeKey}/binary/${fname}`));
    }

    const binaryPath = path.resolve(tmpDir, 'binary', `${internalVersion.name}-${file.fileName}`);
    if (await fs.pathExists(binaryPath)) {
      throw new Error('Uploaded a duplicate file');
    }
    await fs.writeFile(binaryPath, fileData);
    await writeAptMetadata(tmpDir, app);
    await syncDirectoryToStore(
      store,
      storeKey,
      tmpDir,
    );
  });
};
