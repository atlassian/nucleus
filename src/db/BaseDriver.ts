import * as path from 'path';

import store from '../files/store';

const IDENTIFYING_SUFFIXES = ['-full.nupkg', '-delta.nupkg', '.exe', '.zip', '.dmg', '.deb', '.rpm'];

export abstract class IDBDriver {
  public abstract ensureConnected(): Promise<void>;
  public abstract getApps(): Promise<NucleusApp[]>;
  public abstract createApp(owner: User, name: string, icon: Buffer): Promise<NucleusApp>;
  public abstract setTeam(app: NucleusApp, userIdents: string[]): Promise<NucleusApp>;
  public abstract resetAppToken(app: NucleusApp): Promise<NucleusApp>;
  public abstract getApp(id: AppID): Promise<NucleusApp | null>;
  public abstract createChannel(app: NucleusApp, channelName: string): Promise<NucleusChannel>;
  public abstract renameChannel(app: NucleusApp, channel: NucleusChannel, newName: string): Promise<NucleusChannel>;
  public abstract getChannel(app: NucleusApp, channelId: ChannelID): Promise<NucleusChannel | null>;
  public abstract deleteTemporarySave(save: ITemporarySave): Promise<void>;
  public abstract getTemporarySave(temporaryId: number): Promise<ITemporarySave>;
  public abstract getTemporarySaves(app: NucleusApp, channel: NucleusChannel): Promise<ITemporarySave[]>;
  public abstract saveTemporaryVersionFiles(app: NucleusApp, channel: NucleusChannel, version: string, filenames: string[], arch: string, platform: NucleusPlatform): Promise<ITemporarySave>;
  public abstract registerVersionFiles(save: ITemporarySave): Promise<string[]>;
  public abstract createWebHook(app: NucleusApp, url: string, secret: string): Promise<NucleusWebHook>;
  public abstract getWebHook(app: NucleusApp, webHookId: number): Promise<NucleusWebHook>;
  public abstract deleteWebHook(app: NucleusApp, webHookId: number): Promise<void>;
  public abstract createWebHookError(app: NucleusApp, webHookId: number, message: string, code: number, body: string): Promise<void>;
  public abstract setWebHookRegistered(app: NucleusApp, webHookId: number, registered: boolean): Promise<NucleusWebHook>;
}

export default abstract class BaseDriver extends IDBDriver {
  protected async saveIcon(app: NucleusApp, icon: Buffer) {
    await store.putFile(path.posix.join(app.slug, 'icon.png'), icon);
  }

  protected sluggify(name: string) {
    return name.replace(/ /g, '-').replace(/\//, '-');
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
