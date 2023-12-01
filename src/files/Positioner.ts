import * as crypto from 'crypto';
import * as debug from 'debug';
import * as path from 'path';
import * as semver from 'semver';

import { initializeAptRepo, addFileToAptRepo } from './utils/apt';
import { initializeYumRepo, addFileToYumRepo } from './utils/yum';
import { updateDarwinReleasesFiles } from './utils/darwin';
import { updateWin32ReleasesFiles } from './utils/win32';

const hat = require('hat');

const VALID_WINDOWS_SUFFIX = ['-full.nupkg', '-delta.nupkg', '.exe', '.msi'];
const VALID_DARWIN_SUFFIX = ['.dmg', '.zip', '.pkg'];
const CIPHER_MODE = 'aes-256-ctr';

const d = debug('nucleus:positioner');

type PositionerLock = string;

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

    if (!process.env.NO_NUCLEUS_INDEX) {
      // Insert into file index for retreival later, this is purely to avoid making assumptions
      // about file lifetimes for all platforms or assumptions about file positions or assumptions
      // about file names containing version strings (which are currently enforced but may not be
      // in the future)
      await this.store.putFile(this.getIndexKey(app, channel, internalVersion, file), fileData);
    }

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
  }

  public getIndexKey(app: NucleusApp, channel: NucleusChannel, version: NucleusVersion, file: NucleusFile) {
    return path.posix.join(app.slug, channel.id, '_index', version.name, file.platform, file.arch, file.fileName);
  }

  public getLatestKey(app: NucleusApp, channel: NucleusChannel, version: NucleusVersion, file: NucleusFile) {
    const ext = path.extname(file.fileName);
    return path.posix.join(app.slug, channel.id, 'latest', file.platform, file.arch, `${app.name}${ext}`);
  }

  /**
   * Given a version for an app / channel check if any of the files should be uploaded to the "latest"
   * positioning.  This will only occur if the rollout is 100 and the version is the "latest" according
   * to semver.
   */
  public async potentiallyUpdateLatestInstallers(lock: PositionerLock, app: NucleusApp, channel: NucleusChannel) {
    if (lock !== await this.currentLock(app)) return;

    const latestThings: {
      [latestKey: string]: {
        indexKey: string;
        version: string;
      };
    } = {};
    const rolledOutVersions = channel.versions.filter(v => v.rollout === 100 && !v.dead);

    for (const version of rolledOutVersions.sort((a, b) => semver.compare(a.name, b.name))) {
      for (const file of version.files) {
        if (file.type !== 'installer') continue;

        const latestKey = this.getLatestKey(app, channel, version, file);
        const indexKey = this.getIndexKey(app, channel, version, file);

        latestThings[latestKey] = {
          indexKey,
          version: version.name,
        };
      }
    }

    for (const latestKey in latestThings) {
      const latestThing = latestThings[latestKey];
      await this.copyFile(latestThing.indexKey, latestKey, latestThing.version);
    }
  }

  /**
   * It is assumed the called has a validated lock
   */
  private async copyFile(fromKey: string, toKey: string, ref = '') {
    const refKey = `${toKey}.ref`;
    if (!ref || (await this.store.getFile(refKey)).toString() !== ref) {
      await this.store.putFile(
        toKey,
        await this.store.getFile(fromKey),
        true,
      );
      await this.store.putFile(
        refKey,
        Buffer.from(ref),
        true,
      );
    }
  }

  public updateWin32ReleasesFiles = async (lock: PositionerLock, app: NucleusApp, channel: NucleusChannel, arch: string) => {
    if (lock !== await this.currentLock(app)) return;
    return await updateWin32ReleasesFiles({
      app,
      channel,
      arch,
      store: this.store,
      positioner: this,
    });
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
      await updateWin32ReleasesFiles({ app, channel, arch: file.arch, store: this.store, positioner: this });
    }
  }

  public updateDarwinReleasesFiles = async (lock: PositionerLock, app: NucleusApp, channel: NucleusChannel, arch: string) => {
    if (lock !== await this.currentLock(app)) return;
    return await updateDarwinReleasesFiles({
      app,
      channel,
      arch,
      store: this.store,
    });
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
      d('Pushed a zip file to the file store so updating release information in RELEASES.json');
      await updateDarwinReleasesFiles({ app, channel, arch: file.arch, store: this.store });
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
