import S3Store from './s3/S3Store';
import GcpStore from './gcp/GcpStore';
import LocalStore from './local/LocalStore';

import { fileStrategy } from '../config';

let store: IFileStore;

switch (fileStrategy) {
  case 's3':
    store = new S3Store();
    break;
  case 'gcp':
    store = new GcpStore();
    break;
  case 'local':
  default:
    store = new LocalStore();
}

export default store;
