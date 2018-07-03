export const SET_MIGRATIONS = 'SET_MIGRATIONS';

export const setMigrations = (migrations: NucleusMigration[]) => ({
  migrations,
  type: SET_MIGRATIONS,
});
