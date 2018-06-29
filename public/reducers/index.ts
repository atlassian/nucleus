import { combineReducers } from 'redux';

import { user } from './user';
import { apps } from './apps';
import { base } from './base';
import { migrations } from './migrations';

export default combineReducers({
  user,
  apps,
  base,
  migrations,
});
