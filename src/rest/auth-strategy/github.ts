import * as passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github';

import { baseURL, github, adminIdentifiers } from '../../config';

export const useGitHub = () => {
  passport.use(new GitHubStrategy({
    clientID: github.clientID,
    clientSecret: github.clientSecret,
    callbackURL: `${baseURL}/rest/auth/callback`,
  }, (accessToken, refreshToken, profile: any, cb) => {
    profile.isAdmin = adminIdentifiers.indexOf(profile.username) !== -1;
    cb(null, profile);
  }));
  return 'github';
};
