import { useGitHub } from './github';
import { useOpenID } from './openid';
import { useLocal } from './local';

import { authStrategy } from '../../config';

export const initializeStrategy = () => {
  switch (authStrategy) {
    case 'openid':
      return useOpenID();
    case 'github':
      return useGitHub();
    case 'local':
    default:
      return useLocal();
  }
};
