import * as fs from 'fs-extra';
import * as path from 'path';

import * as config from '../../config';

export default class LocalStore implements IFileStore {
  constructor(private localConfig = config.local) {}

  private getPath(key: string) {
    return path.resolve(this.localConfig.root, key);
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
    if (await fs.pathExists(this.getPath(key))) {
      return await fs.readFile(this.getPath(key));
    }
    return Buffer.from('');
  }

  public async deletePath(key: string) {
    if (await fs.pathExists(this.getPath(key))) {
      await fs.remove(this.getPath(key));
    }
  }

  public async getPublicBaseUrl() {
    return this.localConfig.staticUrl;
  }
}
