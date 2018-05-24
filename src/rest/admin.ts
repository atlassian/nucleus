import * as debug from 'debug';
import * as express from 'express';

import driver from '../db/driver';
import { createA } from '../utils/a';
import Positioner from '../files/Positioner';
import store from '../files/store';

const d = debug('nucleus:rest:admin');
const a = createA(d);

const adminRouter = express();

adminRouter.get('/release-locks', a(async (req, res) => {
  const apps = await driver.getApps();
  const positioner = new Positioner(store);

  d(`admin user ${req.user.id} is clearing all existing locks`);

  for (const app of apps) {
    const lock = await positioner.currentLock(app);
    if (lock) {
      d('clearing lock for app:', app.slug);
      await positioner.releaseLock(app, lock);
    }
  }

  d('locks cleared');

  res.json({
    success: 'Locks cleared',
  });
}));

export default adminRouter;
