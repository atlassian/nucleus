import * as semver from 'semver';

import BaseMigration, { MigrationItem } from '../BaseMigration';
import driver from '../../db/driver';
import store from '../../files/store';
import Positioner from '../../files/Positioner';
import { IDBDriver } from '../../db/BaseDriver';

interface LatestInstallerMigrationItem {
  latestKey: string;
  indexKey: string;
  version: string;
}

const SIMULTANEOUS_FETCHES = 5;

export default class LatestInstallerMigration extends BaseMigration<LatestInstallerMigrationItem> {
  key = 'latest-installer';
  friendlyName = 'Latest Installer Migration';
  dependsOn = ['file-index'];
  private positioner: Positioner;

  constructor(private mStore: IFileStore = store, private mDriver: IDBDriver = driver) {
    super();
    this.positioner = new Positioner(mStore);
  }

  async getItems() {
    const apps = await this.mDriver.getApps();
    const itemFetchers: (() => Promise<MigrationItem<LatestInstallerMigrationItem>>)[] = [];

    for (const app of apps) {
      for (const channel of app.channels) {
        const rolledOutVersions = channel.versions.filter(v => v.rollout === 100 && !v.dead);
        if (rolledOutVersions.length === 0) continue;

        // Find latest version
        let version = rolledOutVersions[0];
        for (const tVersion of rolledOutVersions) {
          if (semver.gt(tVersion.name, version.name)) {
            version = tVersion;
          }
        }

        for (const file of version.files) {
          if (file.type !== 'installer') continue;
          const latestKey = this.positioner.getLatestKey(app, channel, version, file);
          const indexKey = this.positioner.getIndexKey(app, channel, version, file);

          itemFetchers.push(async () => ({
            done: (await this.mStore.getFile(`${latestKey}.ref`)).toString() === version.name,
            data: {
              latestKey,
              indexKey,
              version: version.name,
            },
          }));
        }
      }
    }

    const items: MigrationItem<LatestInstallerMigrationItem>[] = [];
    
    const fetchItem = async () => {
      if (itemFetchers.length === 0) return;
      const fetcher = itemFetchers.pop()!;

      items.push(await fetcher());
      await fetchItem();
    };
    await Promise.all((Array(SIMULTANEOUS_FETCHES)).fill(null).map(() => fetchItem()));

    return items;
  }

  async runOnItem(item: MigrationItem<LatestInstallerMigrationItem>)  {
    if (item.done) return;
    this.d(`copying latest file from ${item.data.indexKey} to ${item.data.latestKey} for v${item.data.version}`);

    const file = await this.mStore.getFile(item.data.indexKey);
    await this.mStore.putFile(item.data.latestKey, file, true);
    this.mStore.putFile(`${item.data.latestKey}.ref`, Buffer.from(item.data.version), true);
  }
}
