import * as express from 'express';
import * as passport from 'passport';
import * as session from 'express-session';
import * as createRedisStore from 'connect-redis';

import { initializeStrategy } from './auth-strategy';
import { sessionConfig } from '../config';

const strategyName = initializeStrategy();

passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((user, cb) => cb(null, user));

const router = express();

router.get('/login', passport.authenticate(strategyName), (req, res) => {
  res.redirect('/');
});
router.get('/callback', passport.authenticate(strategyName, { failureRedirect: '/rest/auth/login' }), (req, res) => {
  res.redirect('/');
});
router.get('/logout', (req, res) => {
  req.logOut();
  res.redirect('/');
});

/* tslint:disable */
const RedisStore = createRedisStore(session);
/* tslint:enable */
const sessionOpts: session.SessionOptions = {
  secret: sessionConfig.secret,
  resave: false,
  saveUninitialized: false,
};

switch (sessionConfig.type) {
  case 'redis':
    if (!sessionConfig.redis) {
      console.error('Expected sessionConfig.redis to exist when type=redis');
      process.exit(1);
    } else {
      sessionOpts.store = new RedisStore({
        host: sessionConfig.redis.host,
        port: sessionConfig.redis.port,
      });
    }
    break;
}

export const authenticateRouter = router;
export const setupApp = (app: express.Router) => {
  app.use(session(sessionOpts));
  app.use(passport.initialize());
  app.use(passport.session());
};
