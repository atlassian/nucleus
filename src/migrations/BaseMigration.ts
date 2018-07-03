import * as debug from 'debug';

import driver from '../db/driver';

const d = debug('nucleus:migration-store');

export interface MigrationItem<T> {
  done: boolean;
  data: T;
}

export class MigrationStore {
  private static migrationMap: Map<string, BaseMigration<any>> = new Map();

  static async register(migration: BaseMigration<any>) {
    d('registering a new migration:', migration.key);
    await driver.addMigrationIfNotExists(migration);
    MigrationStore.migrationMap.set(migration.key, migration);
  }

  static get(key: string) {
    return MigrationStore.migrationMap.get(key) || null;
  }

  static getMap() {
    const map: { [key: string]: BaseMigration<any> } = {};
    for (const entry of MigrationStore.migrationMap.entries()) {
      map[entry[0]] = entry[1];
    }
    Object.freeze(map);
    return map;
  }
}

export default abstract class BaseMigration<T> {
  abstract key: string;
  abstract friendlyName: string;
  dependsOn: string[] = [];
  private dMem: debug.IDebugger | null = null;

  protected get d() {
    if (!this.dMem) {
      this.dMem = debug(`nucleus:migration:${this.key}`);
    }
    return this.dMem;
  }

  abstract async getItems(): Promise<MigrationItem<T>[]>;

  abstract async runOnItem(item: MigrationItem<T>): Promise<void>;
}
