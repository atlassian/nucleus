import { Storage, Bucket } from '@google-cloud/storage';
import * as debug from 'debug';

import * as config from '../../config';

const d = debug('nucleus:gcp');

export default class GcpStore implements IFileStore {
  private readonly bucket: Bucket;
  private readonly publicUrl: string;
  private readonly cachePolicyTransient: string;
  constructor() {
    this.cachePolicyTransient = config.gcp.cachePolicyTransient
      ? config.gcp.cachePolicyTransient
      : 'max-age=30';

    this.bucket = new Storage({
      projectId: config.gcp.projectId,
      autoRetry: true,
    }).bucket(config.gcp.bucketName);

    this.publicUrl = config.gcp.publicUrl
      ? config.gcp.publicUrl
      : `https://storage.googleapis.com/${config.gcp.bucketName}`;
  }

  public async hasFile(key: string) {
    const [exists] = await this.bucket.file(key).exists();
    return exists;
  }

  public async getFileSize(key: string) {
    try {
      const [metadata] = await this.bucket.file(key).getMetadata();
      return metadata.size;
    } catch (err) {
      d(
        `failed to fetch file size for '${key}', returning 0 instead. Error message: ${
          err.message
        }`,
      );
      return 0;
    }
  }

  public async putFile(key: string, data: Buffer, overwrite = false) {
    d(`Putting file: '${key}', overwrite=${overwrite ? 'true' : 'false'}`);
    const keyExists = async () => await this.hasFile(key);
    let wrote = false;
    if (overwrite || !(await keyExists())) {
      d(
        `Deciding to write file (either because overwrite is enabled or the key didn't exist)`,
      );

      // if overwrite == true, we assume future changes should be observed quickly
      const metadata =
        overwrite
          ? { cacheControl: this.cachePolicyTransient }
          : undefined;

      // we don't really resume uploads, but this works around https://github.com/googleapis/nodejs-storage/issues/489
      const resumable = data.byteLength > 5000000;

      const stream = this.bucket.file(key).createWriteStream({
        metadata,
        resumable,
        contentType: 'auto',
        public: true,
      });

      await new Promise((resolve, reject) => {

        stream.on('finish', () => {
          resolve();
        });
        stream.on('error', (err) => {
          reject(err);
        });

        stream.end(data);
      });
      d('file write successful');
      wrote = true;
    }
    return wrote;
  }

  public async getFile(key: string) {
    d(`Fetching file: '${key}'`);
    return await new Promise<Buffer>((resolve, reject) => {
      this.bucket.file(key).download((err, content) => {
        if (err) {
          d('File not found, defaulting to empty buffer');
          return resolve(Buffer.from(''));
        }
        resolve(content);
      });
    });
  }

  public async deletePath(key: string) {
    d(`Deleting files under path: '${key}'`);
    await this.bucket.deleteFiles({ prefix: key, force: true });
  }

  public async getPublicBaseUrl() {
    return this.publicUrl;
  }

  public async listFiles(prefix: string) {
    d(`Listing files under path: '${prefix}'`);
    const [files] = await this.bucket.getFiles({ prefix });
    return files.map(file => file.name).filter(key => !!key);
  }
}
