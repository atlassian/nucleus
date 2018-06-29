import { MigrationStore } from './BaseMigration';
import FileIndexMigration from './file-index/FileIndexMigration';
import LatestInstallerMigration from './latest-installer/LatestInstallerMigration';

export const registerMigrations = async () => {
  await MigrationStore.register(new FileIndexMigration());
  await MigrationStore.register(new LatestInstallerMigration());
};
