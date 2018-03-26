import * as passport from 'passport';
import { BasicStrategy } from 'passport-http';

import { localAuth, adminIdentifiers } from '../../config';

export const useLocal = () => {
  passport.use(new BasicStrategy((username, password, done) => {
    for (const user of localAuth) {
      if (user.username === username && user.password === password) {
        const nucleusUser: User = {
          id: user.username,
          displayName: user.displayName,
          isAdmin: adminIdentifiers.indexOf(user.username) !== -1,
          photos: [
            { value: user.photo },
          ],
        };
        return done(null, nucleusUser);
      }
    }
    return done(null, false);
  }));
  return 'basic';
};
