import { combineReducers } from 'redux';

import { user } from './user';
import { apps } from './apps';
import { base } from './base';

export default combineReducers({
  user,
  apps,
  base,
});
