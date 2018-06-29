import * as debug from 'debug';
import * as express from 'express';

import driver from '../db/driver';

const d = debug('nucleus:rest:helpers');

export const requireLogin: express.RequestHandler = (req, res, next) => {
  if (!req.user) {
    d(`Unauthenticated user attempted to access: ${req.url}`);
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

export const requireAdmin: express.RequestHandler = (req, res, next) => {
  return requireLogin(req, res, () => {
    if (!req.user.isAdmin) {
      d(`Non admin user attempted to access: ${req.url}`);
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  });
};

export const noPendingMigrations: express.RequestHandler = async (req, res, next) => {
  try {
    const migrations = await driver.getMigrations();
    if (migrations.find(m => !m.complete)) {
      return res.status(401).json({
        error: 'There is a pending migration, this endpoint has been disabled',
      });
    }
  } catch (err) {
    d('error fetching migrations', err);
    return res.status(500).json({ error: 'This endpoint relies on no pending migrations but we failed to list migrations' });
  }
  next();
};
