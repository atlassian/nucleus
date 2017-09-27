import * as passport from 'passport';
import { Strategy as OpenIDStrategy } from 'passport-openid';

import { baseURL, openid, adminIdentifiers } from '../../config';

const noop = () => '';

export const useOpenID = () => {
  passport.use(new OpenIDStrategy({
    returnURL: `${baseURL}/rest/auth/callback`,
    realm: openid.realm,
    providerURL: openid.providerURL,
    stateless: openid.stateless,
    profile: openid.profile,
  }, (identifier, profile: any, cb) => {
    const email = profile.emails.filter(email => (new RegExp(`@${openid.domain}$`)).test(email.value))[0];
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
