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

interface NucleusVersion {
  name: string;
  dead: boolean;
  rollout: number;
  files: {
    fileName: string;
    arch: string;
    platform: NucleusPlatform;
    type: FileType;
  }[];
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

interface IFileStore {
  putFile(key: string, data: Buffer, overwriteExisting?: boolean): Promise<boolean>;
  getFile(key: string): Promise<Buffer>;
  getPublicBaseUrl(): Promise<string>;
  deletePath(key: string): Promise<void>;
  listFiles(prefix: string): Promise<string[]>;
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
  }>;
}
