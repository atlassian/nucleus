#!/usr/bin/env node

import * as bodyParser from 'body-parser';
import * as compression from 'compression';
import * as debug from 'debug';
import * as express from 'express';
import * as fs from 'fs-extra';
import * as path from 'path';

import { createA } from './utils/a';
import { port, gpgSigningKey } from './config';
import driver from './db/driver';
import store from './files/store';
import appRouter from './rest/app';
import { authenticateRouter, setupApp } from './rest/auth';

const formData = require('express-form-data');

const d = debug('nucleus');
const a = createA(d);

const app = express();

app.use(compression());

app.use(express.static(path.resolve(__dirname, '..', 'public_out')));

app.use(bodyParser.json());
app.use(formData.parse());
app.use(formData.format());

app.use((req, res, next) => {
  res.error = (err) => {
    d('An error occurred inside Nucleus:', err);
    res.status(500).send();
  };
  next();
});

const restRouter = express();
restRouter.get('/deepcheck', async (req, res) => {
  d('Running DeepCheck');
  const dead = (reason: string) => {
    res.status(500).json({ reason, alive: false });
  };
  // Ensure we can connect to the DB
  try {
    await driver.ensureConnected();
  } catch (err) {
    d('DeepCheck failed, could not connect to database', err);
    return dead('database');
  }
  // Ensure we can use the file store
  try {
    const content = `healthy_${Date.now()}`;
    await store.putFile('__deepcheck', Buffer.from(content), true);
    const fetchedContent = await store.getFile('__deepcheck');
    if (fetchedContent.toString() !== content) {
      d('DeepCheck failed, file store retrieved contents did not match put contents');
      return dead('file_store_logic');
    }
    await store.deletePath('__deepcheck');
  } catch (err) {
    d('DeepCheck failed, could not store, retrieve of delete file from file store', err);
    return dead('file_store');
  }
  // All good here
  res.json({ alive: true });
});
restRouter.get('/healthcheck', (req, res) => res.json({ alive: true }));
restRouter.use('/app', appRouter);
restRouter.use('/auth', authenticateRouter);
setupApp(app);

restRouter.get('/config', a(async (req, res) => {
  res.json({
    user: req.user,
    baseUpdateUrl: await store.getPublicBaseUrl(),
  });
}));

app.use('/rest', restRouter);

let contentPromise: Promise<string> | null;

app.use('*', a(async (req, res) => {
  if (!contentPromise) {
    contentPromise = fs.readFile(path.resolve(__dirname, '../public_out/index.html'), 'utf8');
  }
  res.send(await contentPromise);
}));

restRouter.use('*', (req, res) => {
  res.status(404).json({
    error: 'Unknown Path',
  });
});

d('Setting up server');
(async () => {
  d('Connecting to DB');
  try {
    await driver.ensureConnected();
  } catch (err) {
    d('Failed to connect to DB');
    d(err);
    return;
  }
  d('Initializing public GPG key');
  await store.putFile(
    'public.key',
    Buffer.from(gpgSigningKey.split('-----BEGIN PGP PRIVATE KEY BLOCK-----')[0]),
    true,
  );
  d('GPG key now public at:', `${await store.getPublicBaseUrl()}/public.key`);
  app.listen(port, () => {
    d('Nucleus Server started on port:', port);
  });
})();
