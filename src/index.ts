#!/usr/bin/env node

import 'colors';
import * as bodyParser from 'body-parser';
import * as compression from 'compression';
import * as debug from 'debug';
import * as express from 'express';
import * as fs from 'fs-extra';
import * as path from 'path';

import { createA } from './utils/a';
import { port, gpgSigningKey, localAuth } from './config';
import driver from './db/driver';
import store from './files/store';
import adminRouter from './rest/admin';
import appRouter from './rest/app';
import migrationRouter from './rest/migration';
import { authenticateRouter, setupApp } from './rest/auth';
import { isGpgKeyValid } from './files/utils/gpg';
import { registerMigrations } from './migrations';
import { MigrationStore } from './migrations/BaseMigration';

const d = debug('nucleus');
const a = createA(d);

const app = express();

app.use(compression());

app.use(express.static(path.resolve(__dirname, '..', 'public_out')));

app.use(bodyParser.json());

// THIS IS VERY DANGEROUS, WE USE IT TO BYPASS AUTH IN TESTING
if (process.env.UNSAFELY_DISABLE_NUCLEUS_AUTH) {
  d('You have set UNSAFELY_DISABLE_NUCLEUS_AUTH.  THIS IS VERY DANGEROUS');
  app.use((req, res, next) => {
    if (!req.user) {
      const user = localAuth[0];
      req.user = {
        id: user.username,
        displayName: user.displayName,
        isAdmin: true,
        photos: [
          { value: user.photo },
        ],
      };
    }
    next();
  });
}

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
restRouter.use('/migration', migrationRouter);
restRouter.use('/admin', (req, res, next) => {
  if (req.user && req.user.isAdmin) return next();
  return res.status(403).json({ error: 'Not an admin' });
}, adminRouter);
setupApp(app);

restRouter.get('/config', a(async (req, res) => {
  const migrations = (await driver.getMigrations()).map(m => (m as any).get());
  for (const migration of migrations) {
    (migration as any).dependsOn = MigrationStore.get(migration.key)!.dependsOn;
  }

  res.json({
    migrations,
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
  d('Checking GPG key');
  if (!await isGpgKeyValid()) {
    d('Bad gpg key, invalid');
    console.error('GPG key is invalid or missing, you must provide "config.gpgSigningKey"'.red);
    process.exit(1);
  }
  if (!gpgSigningKey.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
    d('Bad gpg key, no public key');
    console.error('GPG key does not contain a public key, you must include both the public and private key in "config.gpgSigningKey"'.red);
    process.exit(1);
  }
  if (!gpgSigningKey.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----')) {
    d('Bad gpg key, no public key');
    console.error('GPG key does not contain a private key, you must include both the public and private key in "config.gpgSigningKey"'.red);
    process.exit(1);
  }
  d('Good gpg key');
  d('Initializing public GPG key');
  await store.putFile(
    'public.key',
    Buffer.from(gpgSigningKey.split('-----BEGIN PGP PRIVATE KEY BLOCK-----')[0]),
    true,
  );
  d('GPG key now public at:', `${await store.getPublicBaseUrl()}/public.key`);
  d('registering migrations');
  await registerMigrations();
  d('migrations all registered');
  app.listen(port, () => {
    d('Nucleus Server started on port:', port);
  });
})().catch((err) => {
  if (typeof err === 'string') {
    console.error(err.red);
  } else {
    console.error(err);
  }
  process.exit(1);
});
