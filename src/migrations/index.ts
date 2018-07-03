import { MigrationStore } from './BaseMigration';
import FileIndexMigration from './file-index/FileIndexMigration';
import LatestInstallerMigration from './latest-installer/LatestInstallerMigration';
import FileSHAMigration from './file-sha/FileSHAMigration';

export const registerMigrations = async () => {
  await MigrationStore.register(new FileIndexMigration());
  await MigrationStore.register(new LatestInstallerMigration());
  await MigrationStore.register(new FileSHAMigration());
};
