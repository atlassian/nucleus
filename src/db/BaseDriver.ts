import * as path from 'path';
import * as semver from 'semver';
import * as toIco from 'to-ico';

import store from '../files/store';
import BaseMigration from '../migrations/BaseMigration';

const IDENTIFYING_SUFFIXES = ['-full.nupkg', '-delta.nupkg', '.exe', '.msi', '.zip', '.dmg', '.pkg', '.deb', '.rpm'];

export abstract class IDBDriver {
  public abstract ensureConnected(): Promise<void>;
  public abstract getApps(): Promise<NucleusApp[]>;
  public abstract createApp(owner: User, name: string, icon: Buffer): Promise<NucleusApp>;
  public abstract setTeam(app: NucleusApp, userIdents: string[]): Promise<NucleusApp>;
  public abstract resetAppToken(app: NucleusApp): Promise<NucleusApp>;
  public abstract getApp(id: AppID): Promise<NucleusApp | null>;
  public abstract createChannel(app: NucleusApp, channelName: string): Promise<NucleusChannel>;
  public abstract renameChannel(app: NucleusApp, channel: NucleusChannel, newName: string): Promise<NucleusChannel | null>;
  public abstract getChannel(app: NucleusApp, channelId: ChannelID): Promise<NucleusChannel | null>;
  public abstract deleteTemporarySave(save: ITemporarySave): Promise<void>;
  public abstract getTemporarySave(temporaryId: number): Promise<ITemporarySave | null>;
  public abstract getTemporarySaves(app: NucleusApp, channel: NucleusChannel): Promise<ITemporarySave[]>;
  public abstract saveTemporaryVersionFiles(app: NucleusApp, channel: NucleusChannel, version: string, filenames: string[], arch: string, platform: NucleusPlatform): Promise<ITemporarySave>;
  public abstract registerVersionFiles(save: ITemporarySave): Promise<string[]>;
  public abstract createWebHook(app: NucleusApp, url: string, secret: string): Promise<NucleusWebHook>;
  public abstract getWebHook(app: NucleusApp, webHookId: number): Promise<NucleusWebHook | null>;
  public abstract deleteWebHook(app: NucleusApp, webHookId: number): Promise<void>;
  public abstract createWebHookError(app: NucleusApp, webHookId: number, message: string, code: number, body: string): Promise<void>;
  public abstract setWebHookRegistered(app: NucleusApp, webHookId: number, registered: boolean): Promise<NucleusWebHook | null>;
  public abstract setVersionDead(app: NucleusApp, channel: NucleusChannel, version: string, dead: boolean): Promise<NucleusChannel>;
  public abstract setVersionRollout(app: NucleusApp, channel: NucleusChannel, version: string, rollout: number): Promise<NucleusChannel>;
  // Migrations
  public abstract addMigrationIfNotExists(migration: BaseMigration<any>): Promise<NucleusMigration>;
  public abstract getMigrations(): Promise<NucleusMigration[]>;
  // SHA
  public abstract storeSHAs(file: NucleusFile, hashes: HashSet): Promise<NucleusFile | null>;
}

export default abstract class BaseDriver extends IDBDriver {
  public async saveIcon(app: NucleusApp, icon: Buffer, wipePrevious = false) {
    await store.putFile(path.posix.join(app.slug, 'icon.png'), icon, wipePrevious);
    const iconAsIco = await toIco([icon], {
      resize: true,
      sizes: [16, 24, 32, 48, 64, 128, 256],
    });
    await store.putFile(path.posix.join(app.slug, 'icon.ico'), iconAsIco, wipePrevious);
  }

  protected sluggify(name: string) {
    return name.replace(/ /g, '-').replace(/\//, '-');
  }

  protected orderVersions(versions: NucleusVersion[]) {
    return ([] as NucleusVersion[]).concat(versions).sort((a, b) => {
      return semver.compare(a.name, b.name);
    });
  }

  protected writeVersionsFileToStore = async (app: NucleusApp, channel: NucleusChannel) => {
    const deepChannel = Object.assign({}, (await this.getApp(app.id!)))
      .channels
      .find(testChannel => testChannel.id === channel.id);
    if (!deepChannel) return;
    const versionsToWrite = deepChannel.versions;
    await store.putFile(path.posix.join(app.slug, channel.id, 'versions.json'), Buffer.from(JSON.stringify(versionsToWrite, null, 2)), true);
  }

  /**
   * This method compares to file names to determine if they are technically the same
   * file in the context of a single version/platform/arch combination.  This is used
   * to ensure we never upload two -full.nupkg files to a single version, or two .dmg
   * files.
   * 
   * @param file1 The name of the first file
   * @param file2 The name of the second file
   */
  protected isInherentlySameFile(file1: string, file2: string) {
    for (const suffix of IDENTIFYING_SUFFIXES) {
      if (file1.endsWith(suffix) && file2.endsWith(suffix)) {
        return true;
      }
    }
    return false;
  }
}
