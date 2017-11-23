import * as crypto from 'crypto';
import * as debug from 'debug';
import * as path from 'path';
import * as semver from 'semver';

const VALID_WINDOWS_SUFFIX = ['-full.nupkg', '-delta.nupkg', '.exe'];
const VALID_DARWIN_SUFFIX = ['.dmg', '.zip'];
const CIPHER_MODE = 'aes-256-ctr';

const d = debug('nucleus:positioner');

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

  public async cleanUpTemporaryFile(app: NucleusApp, saveString: string) {
    d(`Deleting all temporary files for app: ${app.slug} in save ID: ${saveString}`);
    await this.store.deletePath(path.join(app.slug, 'temp', saveString));
  }

  public async handleUpload(app: NucleusApp, channel: NucleusChannel, version: string, arch: string, platform: string, fileName: string, data: Buffer) {
    // Validate arch
    if (arch !== 'ia32' && arch !== 'x64') return;
    d(`Handling upload (${fileName}) for app (${app.slug}) and channel (${channel.name}) for version (${version}) on platform/arch (${platform}/${arch})`);

    switch (platform) {
      case 'win32':
        return await this.handleWindowsUpload(app, channel, version, arch, fileName, data);
      case 'darwin':
        return await this.handleDarwinUpload(app, channel, version, arch, fileName, data);
      case 'linux':
        return await this.handleLinuxUpload(app, channel, version, arch, fileName, data);
    }
  }

  protected async handleWindowsUpload(app: NucleusApp, channel: NucleusChannel, version: string, arch: string, fileName: string, data: Buffer) {
    const root = path.posix.join(app.slug, channel.id, 'win32', arch);
    const key = path.posix.join(root, fileName);
    if (!VALID_WINDOWS_SUFFIX.some(suffix => fileName.endsWith(suffix))) {
      d(`Attempted to upload a file for win32 but it had an invalid suffix: ${fileName}`);
      return;
    }

    if (await this.store.putFile(key, data) && fileName.endsWith('.nupkg')) {
      d('Pushed a nupkg file to the file store so appending release information to RELEASES');
      const releasesKey = path.posix.join(root, 'RELEASES');
      let RELEASES = (await this.store.getFile(releasesKey)).toString('utf8');
      const hash = crypto.createHash('SHA1').update(data).digest('hex').toUpperCase();
      RELEASES += `${RELEASES.length > 0 ? '\n' : ''}${hash} ${fileName} ${data.byteLength}`;
      await this.store.putFile(releasesKey, Buffer.from(RELEASES, 'utf8'), true);
    }
  }

  protected async handleDarwinUpload(app: NucleusApp, channel: NucleusChannel, version: string, arch: string, fileName: string, data: Buffer) {
    const root = path.posix.join(app.slug, channel.id, 'darwin', arch);
    const key = path.posix.join(root, fileName);
    if (!VALID_DARWIN_SUFFIX.some(suffix => fileName.endsWith(suffix))) {
      d(`Attempted to upload a file for darwin but it had an invalid suffix: ${fileName}`);
      return;
    }

    if (await this.store.putFile(key, data) && fileName.endsWith('.zip')) {
      d('Pushed a zip file to the file store so appending release information to RELEASES.json');
      const releasesKey = path.posix.join(root, 'RELEASES.json');
      const releasesJson = JSON.parse((await this.store.getFile(releasesKey)).toString('utf8') || '{"releases":[]}');
      if (!releasesJson.currentRelease || semver.gt(version, releasesJson.currentRelease)) {
        d(`The version '${version}' is considered greater than ${releasesJson.currentRelease} so we're updating currentRelease`);
        releasesJson.currentRelease = version;
      }
      const existingRelease = releasesJson.releases.find(release => release.version === version);
      if (!existingRelease) {
        d(`Release wasn't in RELEASES.json already so we're adding it`);
        releasesJson.releases.push({
          version,
          updateTo: {
            version,
            pub_date: (new Date()).toString(),
            notes: '',
            name: version,
            url: encodeURI(`${await this.store.getPublicBaseUrl()}/${key}`),
          },
        });
        await this.store.putFile(releasesKey, Buffer.from(JSON.stringify(releasesJson, null, 2), 'utf8'), true);
      }
    }
  }

  protected async handleLinuxUpload(app: NucleusApp, channel: NucleusChannel, version: string, arch: string, fileName: string, data: Buffer) {
    console.warn('Will not upload linux file');
  }
}
