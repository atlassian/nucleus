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

    const latestThings: {
      [latestKey: string]: {
        indexKey: string;
        version: string;
      };
    } = {};

    for (const app of apps) {
      for (const channel of app.channels) {
        const rolledOutVersions = channel.versions.filter(v => v.rollout === 100 && !v.dead);

        for (const version of rolledOutVersions.sort((a, b) => semver.compare(a.name, b.name))) {
          for (const file of version.files) {
            if (file.type !== 'installer') continue;

            const latestKey = this.positioner.getLatestKey(app, channel, version, file);
            const indexKey = this.positioner.getIndexKey(app, channel, version, file);

            latestThings[latestKey] = {
              indexKey,
              version: version.name,
            };
          }
        }
      }
    }

    for (const latestKey in latestThings) {
      const latestThing = latestThings[latestKey];

      itemFetchers.push(async () => ({
        done: (await this.mStore.getFile(`${latestKey}.ref`)).toString() === latestThing.version,
        data: {
          latestKey,
          indexKey: latestThing.indexKey,
          version: latestThing.version,
        },
      }));
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
