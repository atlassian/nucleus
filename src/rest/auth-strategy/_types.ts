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

export class OpenIDStrategyType extends PassportStrategy<
  OpenIDStrategyOptions,
  OpenIDCallback<User>
> {}
