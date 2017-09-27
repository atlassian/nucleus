import * as debug from 'debug';
import fetch from 'node-fetch';

import { baseURL } from '../config';
import driver from '../db/driver';

const { version: nucleusVersion } = require('../../package.json');

const d = debug('nucleus:web-hook');

export default class WebHook {
  private id: number;
  private url: string;
  private secret: string;
  private app: NucleusApp;
  private registered: boolean;

  static fromNucleusHook(app: NucleusApp, hook: NucleusWebHook) {
    return new WebHook(hook.id, hook.url, hook.secret, app, hook.registered);
  }

  constructor(id: number, url: string, secret: string, app: NucleusApp, registered: boolean) {
    this.id = id;
    this.url = url;
    this.secret = secret;
    this.app = app;
    this.registered = registered;
  }

  getURL() {
    return this.url;
  }

  private async fire(type: string, extendedInfo: Object) {
    d(`Calling: '${this.url}' with type: '${type}'`);
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          Authorization: this.secret,
          'Content-Type': 'application/json',
          'User-Agent': `Nucleus/${nucleusVersion}`,
        },
        body: JSON.stringify(Object.assign({}, extendedInfo, {
          type,
          nucleusOrigin: baseURL,
          app: {
            id: this.app.id,
            name: this.app.name,
            slug: this.app.slug,
          },
        })),
      });
      if (response.status !== 200) {
        d(`Unexpected status code occurred while calling: ${this.url}`, response.status);
        await driver.createWebHookError(
          this.app,
          this.id,
          `Unexpected status code while calling with type: '${type}'`,
          response.status,
          await response.text(),
        );
        return false;
      } else {
        return true;
      }
    } catch (err) {
      d(`Fetching: ${this.url} failed with error`, err);
      await driver.createWebHookError(
        this.app,
        this.id,
        `Failed to fetch: ${type}`,
        -1,
        err.message,
      );
      return false;
    }
  }

  async register() {
    if (!this.registered) {
      this.registered = await this.fire('register', {});
      await driver.setWebHookRegistered(this.app, this.id, this.registered);
      return this.registered;
    }
  }

  async unregister() {
    if (this.registered) {
      this.registered = !(await this.fire('unregister', {}));
      await driver.setWebHookRegistered(this.app, this.id, this.registered);
      return !this.registered;
    }
    return true;
  }

  async newChannel(channel: NucleusChannel) {
    if (!this.registered) return false;
    return await this.fire('channel_created', {
      channel: {
        id: channel.id,
        name: channel.name,
      },
    });
  }

  async newVersion(channel: NucleusChannel, version: NucleusVersion) {
    if (!this.registered) return false;
    return await this.fire('version_created', {
      channel: {
        id: channel.id,
        name: channel.name,
      },
      version: {
        name: version.name,
      },
    });
  }

  async newVersionFile(channel: NucleusChannel, version: NucleusVersion) {
    if (!this.registered) return false;
    return await this.fire('', {
      channel: {
        id: channel.id,
        name: channel.name,
      },
      version: {
        name: version.name,
        files: version.files,
      },
    });
  }
}
