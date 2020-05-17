import * as path from 'path';

let config: IConfig | null = null;

interface ResolvedConfig {
  err?: any;
  config: IConfig | null;
}

const resolveConfig = (path: string): ResolvedConfig => {
  try {
    require.resolve(path);
  } catch {
    return {
      config: null,
    };
  }
  try {
    return {
      config: require(path),
    };
  } catch (err) {
    return {
      err,
      config: null,
    };
  }
};

const possibleConfigs = [
  path.resolve(__dirname, '../config.js'),
  path.resolve(process.cwd(), 'config.js'),
];

if (process.argv.length > 2) {
  possibleConfigs.unshift(path.resolve(process.cwd(), process.argv[2]));
}

for (const option of possibleConfigs) {
  const resolvedConfig = resolveConfig(option);
  if (resolvedConfig.config) {
    config = resolvedConfig.config;
    break;
  }
  if (resolvedConfig.err) {
    console.error('An error occurred while loading your config file');
    console.error('Please ensure it does not have syntax errors');
    console.error(resolvedConfig.err);
    process.exit(1);
  }
}

if (!config) {
  console.error('Failed to find your config file at any of the search paths');
  console.error('Paths:', possibleConfigs);
  console.error('Please ensure one exists');
  process.exit(1);
}

export const port = config!.port;
export const baseURL = config!.baseURL;
export const uploadTimeout = config!.uploadTimeout || 1800000;
export const fileStrategy = config!.fileStrategy;
export const dbStrategy = config!.dbStrategy;
export const github: GitHubOptions = config!.github || <any>{};
export const openid: OpenIDOptions = config!.openid || <any>{};
export const adminIdentifiers = config!.adminIdentifiers || [];
export const authStrategy = config!.authStrategy;
export const s3 = config!.s3;
export const local = config!.local;
export const sequelize = config!.sequelize;
export const localAuth = config!.localAuth;
export const sessionConfig = config!.sessionConfig;
export const organization = config!.organization;
export const gpgSigningKey = config!.gpgSigningKey;
export const defaultRollout = config!.defaultRollout || 0;

if (
  defaultRollout < 0 ||
  defaultRollout > 100 ||
  typeof defaultRollout !== 'number' ||
  Math.round(defaultRollout) !== defaultRollout
) {
  throw new Error(
    `Expected 'config.defaultRollout' to be an integer between 0 and 100 but it was "${defaultRollout}"`,
  );
}
