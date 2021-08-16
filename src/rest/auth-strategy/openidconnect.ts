import * as passport from 'passport';
const { Strategy } = require('passport-openidconnect');

import { baseURL, openidconnect, adminIdentifiers } from '../../config';
import { OpenIDConnectStrategyType } from './_types';

const noop = () => '';
/* tslint:disable */
const OpenIDConnectStrategy: typeof OpenIDConnectStrategyType = Strategy;
/* tslint:enable */

export const useOpenIDConnect = () => {
  passport.use(new OpenIDConnectStrategy({
    callbackURL: `${baseURL}/rest/auth/callback`,
    issuer: openidconnect.issuer,
    authorizationURL: openidconnect.authorizationURL,
    tokenURL: openidconnect.tokenURL,
    userInfoURL: openidconnect.userInfoURL,
    clientSecret: openidconnect.clientSecret,
    clientID: openidconnect.clientID,
    scope: openidconnect.scopes,
  }, (issuer, sub, profile, accessToken, refreshToken, done) => {
    const emailRegExp = new RegExp(`@${openidconnect.domain}$`);
    const email = profile._json.email;
    if (!email || !emailRegExp.test(email)) {
      return done(null, false, { message: `Not an @${openidconnect.domain} email address.` });
    }

    const user: User = {
      id: email.value,
      displayName: profile.displayName,
      isAdmin: adminIdentifiers.indexOf(email.value) !== -1,
      photos: [
        { value: (openidconnect.photoResolver || noop)(email.value) },
      ],
    };

    done(null, user);
  }));
  return 'openidconnect';
};
