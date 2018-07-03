import * as debug from 'debug';
import * as express from 'express';

import driver from '../db/driver';
import { createA } from '../utils/a';
import BaseMigration, { MigrationStore } from '../migrations/BaseMigration';

import { requireAdmin } from './_helpers';

const d = debug('nucleus:rest:migrations');
const a = createA(d);

const migrationRouter = express();

migrationRouter.use('/:key', requireAdmin, a(async (req, res, next) => {
  const migration = MigrationStore.get(req.params.key);
  if (!migration) {
    return res.status(404).json({
      error: 'Migration with provided key is not found',
    });
  }
  req.migration = {
    internal: (await driver.getMigrations()).find(m => m.key === req.params.key)!,
    migrator: migration,
  };
  next();
}));

migrationRouter.get('/:key', a(async (req, res) => {
  const internalMigrations = await driver.getMigrations();
  const migration: BaseMigration<any> = req.migration.migrator;
  if (internalMigrations.find(m => migration.dependsOn.includes(m.key) && !m.complete)) {
    return res.status(401).json({
      error: 'This migration depends on migrations that have not yet completed',
    });
  }

  const items = await migration.getItems();
  if (items.length === 0 || !items.some(item => !item.done)) {
    req.migration.internal.complete = true;
    await (req.migration.internal as any).save();
  }
  res.json(items);
}));

migrationRouter.post('/:key', a(async (req, res) => {
  if (req.body && req.body.item && req.body.item.data) {
    const migration: BaseMigration<any> = req.migration.migrator;
    await migration.runOnItem(req.body.item);
    if (!(await migration.getItems()).find(item => !item.done)) {
      req.migration.internal.complete = true;
      await (req.migration.internal as any).save();
    }
    res.status(200).send();
  } else {
    res.status(400).json({
      error: 'You must provide an item',
    });
  }
}));

export default migrationRouter;
