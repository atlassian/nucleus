import { MigrationStore } from './BaseMigration';
import FileIndexMigration from './file-index/FileIndexMigration';

export const registerMigrations = async () => {
  await MigrationStore.register(new FileIndexMigration());
};
