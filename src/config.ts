import * as path from 'path';

let config: IConfig | null = null;

try {
  if (process.argv.length > 2) {
    try {
      config = require(path.resolve(process.cwd(), process.argv[2]));
    } catch (err) {
      // Ignore
    }
  }
  if (!config) {
    config = require('../config.js');
  }
} catch (err) {
  console.error(err);
  console.error(
    'Make sure config.js exists and does not contain any syntax errors!',
  );
  process.exit(1);
}

export const port = config!.port;
export const baseURL = config!.baseURL;
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
