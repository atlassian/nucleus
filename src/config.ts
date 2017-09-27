import * as debug from 'debug';
import * as fs from 'fs-extra';
import * as NodeRsa from 'node-rsa';
import * as path from 'path';

const d = debug('nucleus:config');
let config: IConfig = <any>{};

try {
  let configPath = '../config.js';
  if (process.argv.length > 2) {
    configPath = path.resolve(process.cwd(), process.argv[2]);
  }
  config =  require(configPath);
} catch (err) {
  console.error('Could not locate config.js file, please ensure it exists');
  process.exit(1);
}

export const port = config.port;
export const baseURL = config.baseURL;
export const fileStrategy = config.fileStrategy;
export const dbStrategy = config.dbStrategy;
export const github: GitHubOptions = config.github || <any>{};
export const openid: OpenIDOptions = config.openid || <any>{};
export const adminIdentifiers = config.adminIdentifiers || [];
export const authStrategy = config.authStrategy;
export const s3 = config.s3;
export const local = config.local;
export const sequelize = config.sequelize;
export const localAuth = config.localAuth;
export const sessionConfig = config.sessionConfig;
