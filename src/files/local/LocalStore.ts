import * as fs from 'fs-extra';
import * as path from 'path';

import * as config from '../../config';

export default class LocalStore implements IFileStore {
  constructor(private localConfig = config.local) {}

  private getPath(...keys: string[]) {
    return path.resolve(this.localConfig.root, ...keys);
  }

  public async putFile(key: string, data: Buffer, overwrite = false) {
    if (overwrite || !await fs.pathExists(this.getPath(key))) {
      await fs.mkdirp(path.dirname(this.getPath(key)));
      await fs.writeFile(this.getPath(key), data);
      return true;
    }
    return false;
  }

  public async getFile(key: string) {
    if (await this.hasFile(key)) {
      return await fs.readFile(this.getPath(key));
    }
    return Buffer.from('');
  }

  public async getFileSize(key: string) {
    if (await this.hasFile(key)) {
      return (await fs.stat(this.getPath(key))).size;
    }
    return 0;
  }

  public async hasFile(key: string) {
    if (await fs.pathExists(this.getPath(key))) {
      return (await fs.stat(this.getPath(key))).isFile();
    }
    return false;
  }

  public async deletePath(key: string) {
    if (await fs.pathExists(this.getPath(key))) {
      await fs.remove(this.getPath(key));
    }
  }

  public async getPublicBaseUrl() {
    return this.localConfig.staticUrl;
  }

  public async listFiles(prefix: string) {
    const files: string[] = [];
    if (!await fs.pathExists(this.getPath(prefix))) return files;
    for (const child of await fs.readdir(this.getPath(prefix))) {
      const childPath = this.getPath(prefix, child);
      if ((await fs.stat(childPath)).isDirectory()) {
        files.push(...await this.listFiles(path.join(prefix, child)));
      } else {
        files.push(path.join(prefix, child));
      }
    }
    return files;
  }
}
