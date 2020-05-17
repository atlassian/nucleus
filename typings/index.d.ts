interface GitHubOptions {
  clientID: string;
  clientSecret: string;
}

interface OpenIDOptions {
  realm: string;
  providerURL: string;
  stateless: boolean;
  profile: boolean;
  domain: string;
  photoResolver: (email: string) => string;
}

interface S3Options {
  init?: {
    endpoint?: string;
    s3ForcePathStyle?: boolean;
  }

  bucketName: string;

  cloudfront: {
    distributionId: string;
    publicUrl: string;
  } | null
}

interface LocalOptions {
  root: string;
  staticUrl: string;
}

interface SequelizeOptions {
  database: string;
  dialect: string;
  username: string;
  password: string;
  host: string;
  port: number;
  storage: string;
}

interface LocalUser {
  username: string;
  password: string;
  photo: string;
  displayName: string;
}

type LocalAuthOptions = LocalUser[];

interface SessionConfig {
  type: 'redis' | null;
  secret: string;

  redis?: {
    host: string;
    port: number;
  }
}

interface IConfig {
  port: number;
  baseURL: string;
  uploadTimeout: number;
  fileStrategy: string;
  dbStrategy: string;
  authStrategy: string;
  github: GitHubOptions;
  openid: OpenIDOptions;
  adminIdentifiers: string[];
  s3: S3Options;
  local: LocalOptions;
  sequelize: SequelizeOptions;
  localAuth: LocalAuthOptions;
  sessionConfig: SessionConfig;
  organization?: string;
  gpgSigningKey: string;
  defaultRollout: number;
}

interface User {
  id: string;
  displayName: string;
  photos?: { value: string }[],
  isAdmin: boolean;
}

interface IErrorObject {
  [key: string]: string
}

type AppID = string;
type ChannelID = string;
type UserID = string;
type NucleusPlatform = 'darwin' | 'win32' | 'linux';
type FileType = 'installer' | 'update' | 'unkown';

interface NucleusApp {
  id?: AppID;
  name: string;
  slug: string;
  iconUri: string;
  token: string;
  channels: NucleusChannel[];
  team: UserID[];
  webHooks: NucleusWebHook[];
}

interface NucleusWebHook {
  id: number;
  url: string;
  secret: string;
  registered: boolean;
  errors: NucleusWebHookError[]
}

interface NucleusWebHookError {
  id: number;
  message: string;
  responseCode: number;
  responseBody: string;
}

interface NucleusChannel {
  id?: ChannelID;
  name: string;
  versions: NucleusVersion[];
}

interface NucleusFile {
  id?: any;
  fileName: string;
  arch: string;
  platform: NucleusPlatform;
  type: FileType;
  sha1: string;
  sha256: string;
}

interface NucleusVersion {
  name: string;
  dead: boolean;
  rollout: number;
  files: NucleusFile[];
}

interface NucleusMigration {
  key: string;
  friendlyName: string;
  complete: boolean;
}

interface ITemporarySave {
  id: any;
  saveString: string;
  version: string;
  filenames: string[];
  arch: string;
  platform: NucleusPlatform;
  date: Date;
  cipherPassword: string;
}

interface HandlePlatformUploadOpts {
  app: NucleusApp;
  channel: NucleusChannel;
  internalVersion: NucleusVersion;
  file: NucleusFile;
  fileData: Buffer;
}

interface IFileStore {
  putFile(key: string, data: Buffer, overwriteExisting?: boolean): Promise<boolean>;
  hasFile(key: string): Promise<boolean>;
  getFile(key: string): Promise<Buffer>;
  getFileSize(key: string): Promise<number>;
  getPublicBaseUrl(): Promise<string>;
  deletePath(key: string): Promise<void>;
  listFiles(prefix: string): Promise<string[]>;
}

interface HashSet {
  sha1: string;
  sha256: string;
}

declare namespace Express {
  interface Response {
    error(err: IErrorObject): void;
    download(path: string): void;
    status(code: number): Response;
    json(obj: any): Response;
  }

  interface Request {
    body: any;
    targetApp: NucleusApp;
    channel: NucleusChannel;
    migration: {
      internal: NucleusMigration;
      migrator: any;
    };
  }
}

declare module 'is-png' {
  type IsPng = (buffer: Buffer) => boolean;
  const foo: IsPng;
  export = foo;
}

declare module 'to-ico' {
  type ToIco = (files: Buffer[], options: {
    resize?: boolean;
    sizes: (16 | 24 | 32 | 48 | 64 | 128 | 256)[];
  }) => Promise<Buffer>;
  const foo: ToIco;
  export = foo;
}

declare module 'child-process-promise' {
  export const spawn: (exe: string, args: string[], opts?: {
    cwd?: string;
    capture?: string[];
  }) => Promise<{
    stdout: Buffer;
    stderr: Buffer;
  }> & { childProcess: any };
}
