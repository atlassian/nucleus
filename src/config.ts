import * as debug from 'debug';
import * as fs from 'fs-extra';
import * as NodeRsa from 'node-rsa';
import * as path from 'path';

const d = debug('nucleus:config');
let config: IConfig;

try {
  if (process.argv.length > 2) {
    try {
      config = require(path.resolve(process.cwd(), process.argv[2]));
    } catch (err) {
      // Ignore
    }
  }
  if (!config) {
    config =  require('../config.js');
  }
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
