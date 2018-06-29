import * as crypto from 'crypto';
import * as debug from 'debug';
import * as path from 'path';
import * as semver from 'semver';

import { initializeAptRepo, addFileToAptRepo } from './utils/apt';
import { initializeYumRepo, addFileToYumRepo } from './utils/yum';

const hat = require('hat');

const VALID_WINDOWS_SUFFIX = ['-full.nupkg', '-delta.nupkg', '.exe', '.msi'];
const VALID_DARWIN_SUFFIX = ['.dmg', '.zip'];
const CIPHER_MODE = 'aes-256-ctr';

const d = debug('nucleus:positioner');

type PositionerLock = string;

interface MacOSRelease {
  version: string;
  updateTo: {
    version: string;
    pub_date: string;
    notes: string;
    name: string;
    url: string;
  };
}

interface MacOSReleasesStruct {
  currentRelease: string;
  releases: MacOSRelease[];
}

export default class Positioner {
  private store: IFileStore;

  constructor(store: IFileStore) {
    this.store = store;
  }

  /**
   * Note: We encrypt the temporary files here so that no one can access them, they
   * are potentially available on a public facing bucket.  We recognize this is a
   * lot of computation but for safety reasons we must ensure that these files can't
   * accidentally (or malicously) be accessed by third parties 
   */
  public async saveTemporaryFile(app: NucleusApp, saveString: string, fileName: string, data: Buffer, cipherPassword: string) {
    d(`Saving temporary file: ${saveString}/${fileName} for app: ${app.slug}`);
    const key = path.join(app.slug, 'temp', saveString, fileName);
    const cipher = crypto.createCipher(CIPHER_MODE, cipherPassword);
    const cryptedBuffer = Buffer.concat([cipher.update(data), cipher.final()]);
    await this.store.putFile(key, cryptedBuffer);
  }

  public async getTemporaryFile(app: NucleusApp, saveString: string, fileName: string, cipherPassword: string) {
    d(`Fetching temporary file: ${saveString}/${fileName} for app: ${app.slug}`);
    const key = path.join(app.slug, 'temp', saveString, fileName);
    const decipher = crypto.createDecipher(CIPHER_MODE, cipherPassword);
    const data = await this.store.getFile(key);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  public async cleanUpTemporaryFile(lock: PositionerLock, app: NucleusApp, saveString: string) {
    if (lock !== await this.currentLock(app)) return;
    d(`Deleting all temporary files for app: ${app.slug} in save ID: ${saveString}`);
    await this.store.deletePath(path.join(app.slug, 'temp', saveString));
  }

  /**
   * Handle the upload / release of a given file for a given version.  This will do a few things
   *
   * * Position the file at the correct place for the given OS and update the required metadata
   * * Add the file to the _index for the given app/channel/version
   * * Copy the file to the "latest" position if it is semantically the latest release at 100% rollout
   */
  public async handleUpload(lock: PositionerLock, {
    app,
    channel,
    internalVersion,
    file,
    fileData,
  }: {
    app: NucleusApp;
    channel: NucleusChannel;
    internalVersion: NucleusVersion,
    file: NucleusFile;
    fileData: Buffer;
  }) {
    // Validate arch
    if (lock !== await this.currentLock(app)) return;
    if (file.arch !== 'ia32' && file.arch !== 'x64') return;
    d(`Handling upload (${file.fileName}) for app (${app.slug}) and channel (${channel.name}) for version (${internalVersion.name}) on platform/arch (${file.platform}/${file.arch})`);

    switch (file.platform) {
      case 'win32':
        await this.handleWindowsUpload({ app, channel, internalVersion, file, fileData });
        break;
      case 'darwin':
        await this.handleDarwinUpload({ app, channel, internalVersion, file, fileData });
        break;
      case 'linux':
        await this.handleLinuxUpload({ app, channel, internalVersion, file, fileData });
        break;
      default:
        return;
    }

    if (!process.env.NO_NUCLEUS_INDEX) {
      // Insert into file index for retreival later, this is purely to avoid making assumptions
      // about file lifetimes for all platforms or assumptions about file positions or assumptions
      // about file names containing version strings (which are currently enforced but may not be
      // in the future)
      await this.store.putFile(this.getIndexKey(app, channel, internalVersion, file), fileData);
    }

    if (internalVersion.rollout === 100 && this.isLatestRelease(internalVersion, channel)) {
      await this.copyFileToLatest(app, channel, internalVersion, file);
    }
  }

  public getIndexKey(app: NucleusApp, channel: NucleusChannel, version: NucleusVersion, file: NucleusFile) {
    return path.posix.join(app.slug, channel.id, '_index', version.name, file.platform, file.arch, file.fileName);
  }

  /**
   * Given a version for an app / channel check if any of the files should be uploaded to the "latest"
   * positioning.  This will only occur if the rollout is 100 and the version is the "latest" according
   * to semver.
   */
  public async potentiallyUpdateLatestInstallers(lock: PositionerLock, app: NucleusApp, channel: NucleusChannel, internalVersion: NucleusVersion) {
    if (lock !== await this.currentLock(app)) return;
    if (internalVersion.rollout !== 100) return;
    if (!this.isLatestRelease(internalVersion, channel)) return;

    for (const file of internalVersion.files) {
      await this.copyFileToLatest(app, channel, internalVersion, file);
    }
  }

  /**
   * It is assumed the called has a validated lock
   */
  private async copyFileToLatest(app: NucleusApp, channel: NucleusChannel, version: NucleusVersion, file: NucleusFile) {
    if (file.type === 'installer') {
      const ext = path.extname(file.fileName);
      await this.store.putFile(
        path.posix.join(app.slug, channel.id, file.platform, file.arch, `${app.name}${ext}`),
        await this.store.getFile(this.getIndexKey(app, channel, version, file)),
        true,
      );
    }
  }

  private isLatestRelease(version: NucleusVersion, channel: NucleusChannel) {
    const greaterVersion = channel.versions.find(v => semver.gt(v.name, version.name));
    return !greaterVersion;
  }

  protected async handleWindowsUpload({
    app,
    channel,
    file,
    fileData,
  }: HandlePlatformUploadOpts) {
    const root = path.posix.join(app.slug, channel.id, 'win32', file.arch);
    const key = path.posix.join(root, file.fileName);
    if (!VALID_WINDOWS_SUFFIX.some(suffix => file.fileName.endsWith(suffix))) {
      d(`Attempted to upload a file for win32 but it had an invalid suffix: ${file.fileName}`);
      return;
    }

    if (await this.store.putFile(key, fileData) && file.fileName.endsWith('.nupkg')) {
      d('Pushed a nupkg file to the file store so appending release information to RELEASES');
      const releasesKey = path.posix.join(root, 'RELEASES');
      let RELEASES = (await this.store.getFile(releasesKey)).toString('utf8');
      const hash = crypto.createHash('SHA1').update(fileData).digest('hex').toUpperCase();
      RELEASES += `${RELEASES.length > 0 ? '\n' : ''}${hash} ${file.fileName} ${fileData.byteLength}`;
      await this.store.putFile(releasesKey, Buffer.from(RELEASES, 'utf8'), true);
    }
  }

  protected async handleDarwinUpload({
    app,
    channel,
    internalVersion,
    file,
    fileData,
  }: HandlePlatformUploadOpts) {
    const root = path.posix.join(app.slug, channel.id, 'darwin', file.arch);
    const fileKey = path.posix.join(root, file.fileName);
    if (!VALID_DARWIN_SUFFIX.some(suffix => file.fileName.endsWith(suffix))) {
      d(`Attempted to upload a file for darwin but it had an invalid suffix: ${file.fileName}`);
      return;
    }

    if (await this.store.putFile(fileKey, fileData) && file.fileName.endsWith('.zip')) {
      d('Pushed a zip file to the file store so appending release information to RELEASES.json');
      const releasesKey = path.posix.join(root, 'RELEASES.json');
      const releasesJson: MacOSReleasesStruct = {
        releases: [],
        currentRelease: '',
      };
      let greatestVersion = internalVersion;
      for (const testVersion of channel.versions) {
        if (semver.gt(testVersion.name, greatestVersion.name)) {
          greatestVersion = testVersion;
        }
      }

      d(`The version '${greatestVersion.name}' is considered the greatest release, so setting that to currentRelease`);
      releasesJson.currentRelease = greatestVersion.name;

      for (const version of channel.versions) {
        if (!releasesJson.releases.some(release => release.version === version.name)) {
          const zipFileInVersion = version.files.find(
            f => f.fileName.endsWith('.zip')  && f.platform === 'darwin' && f.arch === 'x64',
          );
          if (!zipFileInVersion) {
            d(`no zip file in ${version.name}, skipping from RELEASES.json`);
            continue;
          }
          const zipFileKey = path.posix.join(root, zipFileInVersion.fileName);
          d(`adding version ${version.name} to RELEASES.json`);
          releasesJson.releases.push({
            version: version.name,
            updateTo: {
              version: version.name,
              // FIXME: We should store the creation date on the NucleusVersion
              pub_date: (new Date()).toString(),
              notes: '',
              name: version.name,
              url: encodeURI(`${await this.store.getPublicBaseUrl()}/${zipFileKey}`),
            },
          });
        }
      }

      await this.store.putFile(releasesKey, Buffer.from(JSON.stringify(releasesJson, null, 2), 'utf8'), true);
    }
  }

  protected async handleLinuxUpload({
    app,
    channel,
    internalVersion,
    file,
    fileData,
  }: HandlePlatformUploadOpts) {
    if (file.fileName.endsWith('.rpm')) {
      d('Adding rpm file to yum repo');
      await addFileToYumRepo(this.store, { app, channel, file, fileData, internalVersion });
    } else if (file.fileName.endsWith('.deb')) {
      d('Adding deb file to apt repo');
      await addFileToAptRepo(this.store, { app, channel, file, fileData, internalVersion });
    } else {
      console.warn('Will not upload unknown linux file');
    }
  }

  /**
   * Don't use unless you know what you're doing
   */
  public currentLock = async (app: NucleusApp) => {
    const lockFile = path.posix.join(app.slug, '.lock');
    return (await this.store.getFile(lockFile)).toString('utf8');
  }

  public requestLock = async (app: NucleusApp): Promise<PositionerLock | null> => {
    const lockFile = path.posix.join(app.slug, '.lock');
    const lock = hat();
    const currentLock = (await this.store.getFile(lockFile)).toString('utf8');
    if (currentLock === '') {
      await this.store.putFile(lockFile, Buffer.from(lock), true);
      return lock;
    }
    return null;
  }

  public releaseLock = async (app: NucleusApp, lock: PositionerLock) => {
    const lockFile = path.posix.join(app.slug, '.lock');
    const currentLock = (await this.store.getFile(lockFile)).toString('utf8');
    if (currentLock === lock) {
      await this.store.deletePath(lockFile);
    }
  }

  public withLock = async (app: NucleusApp, fn: (lock: PositionerLock) => Promise<void>): Promise<boolean> => {
    const lock = await this.requestLock(app);
    if (!lock) return false;
    try {
      await fn(lock);
    } catch (err) {
      await this.releaseLock(app, lock);
      throw err;
    }
    await this.releaseLock(app, lock);
    return true;
  }

  public initializeStructure = async (app: NucleusApp, channel: NucleusChannel) => {
    await initializeYumRepo(this.store, app, channel);
    await initializeAptRepo(this.store, app, channel);
    await this.store.putFile(path.posix.join(app.slug, channel.id, 'versions.json'), Buffer.from(JSON.stringify([])));
  }
}
