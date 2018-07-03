import BaseMigration, { MigrationItem } from '../BaseMigration';
import driver from '../../db/driver';
import store from '../../files/store';
import Positioner from '../../files/Positioner';
import { IDBDriver } from '../../db/BaseDriver';
import { generateSHAs } from '../../files/utils/sha';

interface FileSHAMigrationItem {
  fileId: number;
  indexKey: string;
}

export default class FileSHAMigration extends BaseMigration<FileSHAMigrationItem> {
  key = 'file-sha';
  friendlyName = 'File SHA Migration';
  dependsOn = ['file-index'];
  private positioner: Positioner;

  constructor(private mStore: IFileStore = store, private mDriver: IDBDriver = driver) {
    super();
    this.positioner = new Positioner(mStore);
  }

  async getItems() {
    const apps = await this.mDriver.getApps();
    const items: MigrationItem<FileSHAMigrationItem>[] = [];

    for (const app of apps) {
      for (const channel of app.channels) {
        for (const version of channel.versions) {
          for (const file of version.files) {
            items.push({
              done: Boolean(file.sha1 && file.sha256),
              data: {
                fileId: file.id,
                indexKey: this.positioner.getIndexKey(app, channel, version, file),
              },
            });
          }
        }
      }
    }
    
    return items;
  }

  async runOnItem(item: MigrationItem<FileSHAMigrationItem>)  {
    if (item.done) return;
    this.d(`generated SHAs for file(${item.data.fileId}) located at ${item.data.indexKey}`);

    const file = await this.mStore.getFile(item.data.indexKey);
    await this.mDriver.storeSHAs({ id: item.data.fileId } as any, generateSHAs(file));
  }
}
