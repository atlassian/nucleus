import { Table, Column, Model, HasMany, Unique, BelongsTo, Sequelize, DataType, ForeignKey } from 'sequelize-typescript';

import * as debug from 'debug';

import * as config from '../../../config';
import { QueryInterface } from 'sequelize';

@Table
export class App extends Model<App> {
  @Column(DataType.STRING)
  name: string;

  @Column(DataType.STRING)
  slug: string;

  @Column(DataType.STRING)
  token: string;

  @HasMany(() => TeamMember)
  team: TeamMember[];

  @HasMany(() => Channel)
  channels: Channel[];

  @HasMany(() => WebHook)
  webHooks: WebHook[];
}

@Table
export class WebHook extends Model<WebHook> {
  @Column(DataType.STRING)
  url: string;

  @Column(DataType.STRING)
  secret: string;

  @Column(DataType.BOOLEAN)
  registered: boolean;

  @ForeignKey(() => App)
  @Column(DataType.INTEGER)
  appId: number;

  @BelongsTo(() => App)
  app: App;

  @HasMany(() => WebHookError)
  errors: WebHookError[];
}

@Table
export class WebHookError extends Model<WebHookError> {
  @Column(DataType.STRING(1000))
  message: string;

  @Column(DataType.INTEGER)
  responseCode: number;

  @Column(DataType.STRING(10000))
  responseBody: string;

  @ForeignKey(() => WebHook)
  @Column(DataType.INTEGER)
  webHookId: number;

  @BelongsTo(() => WebHook)
  webHook: WebHook;
}

@Table
export class TeamMember extends Model<TeamMember> {
  @Column(DataType.STRING)
  userId: string;

  @ForeignKey(() => App)
  @Column(DataType.INTEGER)
  appId: number;

  @BelongsTo(() => App)
  app: App;
}

@Table
export class Channel extends Model<Channel> {
  @Unique
  @Column(DataType.STRING)
  stringId: string;

  @Column(DataType.STRING)
  name: string;

  @ForeignKey(() => App)
  @Column(DataType.INTEGER)
  appId: number;

  @BelongsTo(() => App)
  app: App;

  @HasMany(() => Version)
  versions: Version[];

  @HasMany(() => TemporarySave)
  temporarySaves: TemporarySave[];
}
// version: string, filenames: string[], arch: string, platform: NucleusPlatform// 
@Table
export class TemporarySave extends Model<TemporarySave> {
  @Unique
  @Column(DataType.STRING)
  saveString: string;

  @Column(DataType.STRING)
  version: string;

  @Column(DataType.STRING)
  arch: string;

  @Column(DataType.STRING)
  platform: string;

  @Column(DataType.DATE)
  date: Date;

  @Column(DataType.STRING)
  cipherPassword: string;

  @ForeignKey(() => Channel)
  @Column(DataType.INTEGER)
  channelId: number;

  @BelongsTo(() => Channel)
  channel: Channel;

  @HasMany(() => TemporarySaveFile)
  files: TemporarySaveFile[];
}

@Table
export class TemporarySaveFile extends Model<TemporarySaveFile> {
  @Column(DataType.STRING)
  name: string;

  @ForeignKey(() => TemporarySave)
  @Column(DataType.INTEGER)
  temporarySaveId: number;

  @BelongsTo(() => TemporarySave)
  temporarySave: TemporarySave;
}

@Table
export class Version extends Model<Version> {
  @Column(DataType.STRING)
  name: string;

  @Column(DataType.BOOLEAN)
  dead: boolean;

  @Column(DataType.INTEGER)
  rollout: number;

  @ForeignKey(() => Channel)
  @Column(DataType.INTEGER)
  channelId: number;

  @BelongsTo(() => Channel)
  channel: Channel;

  @HasMany(() => File)
  files: File[];
}

@Table
export class File extends Model<File> {
  @Column(DataType.STRING)
  fileName: string;

  @Column(DataType.STRING)
  platform: string;

  @Column(DataType.STRING)
  arch: string;

  @Column(DataType.STRING)
  type: string;

  @ForeignKey(() => Version)
  @Column(DataType.INTEGER)
  versionId: number;

  @BelongsTo(() => Version)
  version: Version;
}

@Table
export class Migration extends Model<Migration> implements NucleusMigration {
  @Column(DataType.STRING)
  key: string;

  @Column(DataType.STRING)
  friendlyName: string;

  @Column(DataType.BOOLEAN)
  complete: boolean;
}

const d = debug('nucleus:db:migrator');

const upwardsMigrations: ((queryInterface: QueryInterface) => Promise<void>)[] = [
  async function addRolloutToVersion(queryInterface: QueryInterface) {
    const versionDescription = await queryInterface.describeTable(Version.getTableName());
    if (Object.keys(versionDescription).indexOf('rollout') === -1) {
      await queryInterface.addColumn(Version.getTableName() as string, 'rollout', {
        type: (Version as any).attributes.rollout.type,
      });
      await Version.update({
        rollout: 100,
      }, {
        where: {
          rollout: {
            $eq: null,
          },
        },
      });
      d('adding the rollout column to version table');
    }
  },
];

export default async function () {
  const sequelize = new Sequelize({
    database: config.sequelize.database,
    dialect: config.sequelize.dialect,
    username: config.sequelize.username,
    password: config.sequelize.password,
    host: config.sequelize.host,
    port: config.sequelize.port,
    storage: config.sequelize.storage,
    logging: false,
  });

  sequelize.addModels([
    File,
    Version,
    Channel,
    TeamMember,
    App,
    TemporarySave,
    TemporarySaveFile,
    WebHook,
    WebHookError,
    Migration,
  ]);

  await sequelize.authenticate();
  await sequelize.sync();

  const queryInterface = sequelize.getQueryInterface();

  for (const migrationFn of upwardsMigrations) {
    await migrationFn(queryInterface);
  }

  return sequelize;
}
