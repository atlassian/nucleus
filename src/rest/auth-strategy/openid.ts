import * as passport from 'passport';
const { Strategy } = require('passport-openid');

import { baseURL, openid, adminIdentifiers } from '../../config';
import { OpenIDStrategyType } from './_types';

const noop = () => '';
/* tslint:disable */
const OpenIDStrategy: typeof OpenIDStrategyType = Strategy;
/* tslint:enable */

export const useOpenID = () => {
  passport.use(new OpenIDStrategy({
    returnURL: `${baseURL}/rest/auth/callback`,
    realm: openid.realm,
    providerURL: openid.providerURL,
    stateless: openid.stateless,
    profile: openid.profile,
  }, (identifier, profile, cb) => {
    const email = (profile.emails || []).filter(email => (new RegExp(`@${openid.domain}$`)).test(email.value))[0];
    if (!email) {
      return cb(null, false, { message: `Not an @${openid.domain} email address.` });
    }

    const user: User = {
      id: email.value,
      displayName: profile.displayName,
      isAdmin: adminIdentifiers.indexOf(email.value) !== -1,
      photos: [
        { value: (openid.photoResolver || noop)(email.value) },
      ],
    };

    cb(null, user);
  }));
  return 'openid';
};
