import * as path from 'path';

import BaseMigration, { MigrationItem } from '../BaseMigration';
import driver from '../../db/driver';
import store from '../../files/store';
import Positioner from '../../files/Positioner';
import { IDBDriver } from '../../db/BaseDriver';

interface FileIndexMigrationItem {
  indexKey: string;
  originalKey: string;
}

const SIMULTANEOUS_FETCHES = 5;

export default class FileIndexMigration extends BaseMigration<FileIndexMigrationItem> {
  key = 'file-index';
  friendlyName = 'File Index Migration';
  private positioner: Positioner;

  constructor(private mStore: IFileStore = store, private mDriver: IDBDriver = driver) {
    super();
    this.positioner = new Positioner(mStore);
  }

  async getItems() {
    const apps = await this.mDriver.getApps();
    const itemFetchers: (() => Promise<MigrationItem<FileIndexMigrationItem>>)[] = [];

    for (const app of apps) {
      for (const channel of app.channels) {
        for (const version of channel.versions) {
          for (const file of version.files) {
            const indexKey = this.positioner.getIndexKey(app, channel, version, file);
            let originalKey = path.posix.join(app.slug, channel.id, file.platform, file.arch, file.fileName);
            if (file.platform === 'linux') {
              if (/\.deb$/.test(file.fileName)) {
                originalKey = path.posix.join(app.slug, channel.id, file.platform, 'debian', 'binary', `${version.name}-${file.fileName}`);
              } else if (/\.rpm$/.test(file.fileName)) {
                originalKey = path.posix.join(app.slug, channel.id, file.platform, 'redhat', `${version.name}-${file.fileName}`);
              }
            }

            itemFetchers.push(async () => ({
              done: await this.mStore.hasFile(indexKey),
              data: {
                indexKey,
                originalKey,
              },
            }));
          }
        }
      }
    }

    const items: MigrationItem<FileIndexMigrationItem>[] = [];
    
    const fetchItem = async () => {
      if (itemFetchers.length === 0) return;
      const fetcher = itemFetchers.pop()!;

      items.push(await fetcher());
      await fetchItem();
    };
    await Promise.all((Array(SIMULTANEOUS_FETCHES)).fill(null).map(() => fetchItem()));

    return items;
  }

  async runOnItem(item: MigrationItem<FileIndexMigrationItem>)  {
    if (item.done) return;
    this.d(`copying file from ${item.data.originalKey} to ${item.data.indexKey}`);

    const file = await this.mStore.getFile(item.data.originalKey);
    await this.mStore.putFile(item.data.indexKey, file);
  }
}
