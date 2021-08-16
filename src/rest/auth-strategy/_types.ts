import * as passport from 'passport';

class PassportStrategy<O, C> implements passport.Strategy {
  constructor(options: O, cb: C) {}
  // Fake authenticate impl
  authenticate() {}
}
type PassportCallback<U> = (err: null, user: U | false, error?: { message: string }) => void;
interface OpenIDStrategyOptions {
  returnURL: string;
  realm: string;
  providerURL: string;
  stateless: boolean;
  profile: boolean;
}
type OpenIDCallback<U> = (identifer: string, profile: passport.Profile, cb: PassportCallback<U>) => void;

interface OpenIDConnectStrategyOptions {
  issuer: string;
  authorizationURL: string;
  tokenURL: string;
  userInfoURL: string;
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope: string[] | string;
}

// https://github.com/jaredhanson/passport-openidconnect/blob/master/lib/strategy.js#L183-L201
interface PassportOIDCProfile {
  id: string;
  displayName: string;
  username?: string;
  name?: {
    familyName: string;
    givenName: string;
    middleName?: string;
  };
  _raw: string;
  _json: any;
}

// See: https://github.com/jaredhanson/passport-openidconnect/blob/master/lib/strategy.js#L220-L245
// Callback has variable arguments that are dependent on what the caller expects
type OpenIDConnectCallback<U> = (issuer: string, sub:string, profile: PassportOIDCProfile, accessToken: string, refreshToken: string, verified: PassportCallback<U>) => void;

export class OpenIDStrategyType extends PassportStrategy<
  OpenIDStrategyOptions,
  OpenIDCallback<User>
> {}
export class OpenIDConnectStrategyType extends PassportStrategy<
  OpenIDConnectStrategyOptions,
  OpenIDConnectCallback<User>
> {}
