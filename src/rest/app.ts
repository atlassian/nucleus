import * as debug from 'debug';
import * as express from 'express';
import * as semver from 'semver';
import * as isPng from 'is-png';
import * as multer from 'multer';

import { createA } from '../utils/a';
import driver from '../db/driver';
import store from '../files/store';
import Positioner from '../files/Positioner';
import { generateSHAs } from '../files/utils/sha';
import WebHook from './WebHook';

import { requireLogin, noPendingMigrations } from './_helpers';
import { uploadTimeout } from '../config';

const d = debug('nucleus:rest');
const router = express();
const a = createA(d);
const upload = multer();

const updateStaticReleaseMetaData = async (app: NucleusApp, channel: NucleusChannel) => {
  const upToDateChannel = (await driver.getChannel(app, channel.id!))!;

  const positioner = new Positioner(store);
  await positioner.withLock(app, async (lock) => {
    await positioner.updateDarwinReleasesFiles(lock, app, upToDateChannel, 'x64');
    await positioner.updateWin32ReleasesFiles(lock, app, upToDateChannel, 'ia32');
    await positioner.updateWin32ReleasesFiles(lock, app, upToDateChannel, 'x64');
  });
};

const checkField = (req: Express.Request, res: Express.Response, field: string) => {
  if (!req.body) {
    res.status(400).json({
      error: 'Missing POST body',
    });
    return false;
  }
  if (typeof req.body[field] === 'undefined') {
    res.status(400).json({
      error: `Missing required body param: "${field}"`,
    });
    return false;
  }
  return true;
};
const checkFields = (req: Express.Request, res: Express.Response, fields: string[]) => {
  for (const field of fields) {
    if (!checkField(req, res, field)) {
      return false;
    }
  }
  return true;
};

const hasPermission = (req: Express.Request, app: NucleusApp) => {
  return req.user && ((req.user as User).isAdmin || app.team.indexOf(req.user.id) !== -1);
};

const onlyPermission = (req: Express.Request, apps: NucleusApp[]) => {
  return apps.filter(app => hasPermission(req, app));
};

const sortApps = (apps: NucleusApp[]) => {
  return apps.sort((a, b) => a.name.localeCompare(b.name));
};

const runHooks = (app: NucleusApp, runner: (hook: WebHook) => void) => {
  for (const rawHook of app.webHooks) {
    runner(WebHook.fromNucleusHook(app, rawHook));
  }
};

router.get('/', requireLogin, a(async (req, res) => {
  d('Listing applications');
  res.json(onlyPermission(req, sortApps(await driver.getApps())));
}));

const MAGIC_NAMES = [
  '__healthcheck',
  'public.key',
];

router.post('/', requireLogin, noPendingMigrations, upload.single('icon'), a(async (req, res) => {
  if (checkField(req, res, 'name')) {
    // It's unlikely but let's not shoot ourselves in the foot
    // In the healthcheck we use __healthcheck as a magic file to
    // ensure that the file store is alive and working.
    // We need to disallow that app name from being created
    if (MAGIC_NAMES.includes(req.body.name)) {
      return res.status(400).json({ error: `You can not call your application ${req.body.name}` });
    }

    if (req.body.name === '') {
      return res.status(400).json({ error: 'Your app name can not be an empty string' });
    }

    if (req.file) {
      d(`Creating a new application: '${req.body.name}'`);
      const iconBuffer = req.file.buffer;
      if (!isPng(iconBuffer)) {
        return res.status(400).json({ error: 'Not PNG' });
      }
      res.json(await driver.createApp(req.user as User, req.body.name, iconBuffer));
    } else {
      res.status(400).json({ error: 'Missing icon file' });
    }
  }
}));

router.use('/:id', a(async (req, res, next) => {
  const app = await driver.getApp(req.params.id);
  if (!app) {
    res.status(404).json({
      error: 'App not found',
    });
  } else {
    req.targetApp = app;
    next();
  }
}));

const stopNoPerms = (req: Express.Request, res: Express.Response) => {
  if (!hasPermission(req, req.targetApp)) {
    d(`A user (${req.user.id}) tried to access an application (${req.targetApp.slug}) that they don't have permission for`);
    res.status(403).json({
      error: 'No Permission',
    });
    return true;
  }
  return false;
};

router.get('/:id', requireLogin, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  d(`Fetching application: ${req.targetApp.slug}`);
  res.json(req.targetApp);
}));

router.post('/:id/icon', requireLogin, noPendingMigrations, upload.single('icon'), a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  d(`Setting new application icon: ${req.targetApp.slug}`);
  if (req.file) {
    const iconBuffer = req.file.buffer;
    if (!isPng(iconBuffer)) {
      return res.status(400).json({ error: 'Not PNG' });
    }
    await driver.saveIcon(req.targetApp, iconBuffer, true);
    res.status(200).json({ success: true });
  } else {
    res.status(400).json({ error: 'Missing icon file' });
  }
}));

router.post('/:id/refresh_token', requireLogin, noPendingMigrations, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  d(`Regenerating the authentication token for app: ${req.targetApp.slug}`);
  res.json(await driver.resetAppToken(req.targetApp));
}));

router.post('/:id/team', requireLogin, noPendingMigrations, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  if (checkFields(req, res, ['team'])) {
    let team: string[];
    try {
      team = JSON.parse(req.body.team);
    } catch {
      return res.status(400).json({ error: 'Provided parameter "team" is not valid JSON' });
    }
    if (Array.isArray(team) && team.length > 0 && team.indexOf(req.user.id) !== -1) {
      d(`Updating team for app: '${req.targetApp.name}' to be: [${team.join(', ')}]`);
      res.json(await driver.setTeam(req.targetApp, team));
    } else {
      d(`Invalid team array for app '${req.targetApp.slug}' was sent to Nucleus`);
      res.status(400).json({ error: 'Bad team' });
    }
  }
}));

router.post('/:id/webhook', requireLogin, noPendingMigrations, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  if (checkFields(req, res, ['url', 'secret'])) {
    if (typeof req.body.url !== 'string' ||
        (!req.body.url.startsWith('https://') && !req.body.url.startsWith('http://')) ||
        req.body.url.startsWith('http://localhost') || req.body.url.startsWith('http://127.0.0.1')) {
      return res.status(400).json({ error: 'Invalid URL provided' });
    }
    d(`Creating new WebHook: '${req.body.url}' for app: '${req.targetApp.slug}'`);
    const rawHook = await driver.createWebHook(req.targetApp, req.body.url, req.body.secret);
    const hook = WebHook.fromNucleusHook(req.targetApp, rawHook);
    const success = await hook.register();
    res.json({
      success,
      hook: await driver.getWebHook(req.targetApp, rawHook.id),
    });
  }
}));

router.delete('/:id/webhook/:webHookId', requireLogin, noPendingMigrations, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  d(`Deleting WebHook: '${req.params.webHookId}' for app: '${req.targetApp.slug}'`);
  const rawHook = await driver.getWebHook(req.targetApp, req.params.webHookId);
  if (!rawHook) return res.status(404).json({ error: 'Not Found' });
  const hook = WebHook.fromNucleusHook(req.targetApp, rawHook);
  await hook.unregister();
  await driver.deleteWebHook(req.targetApp, req.params.webHookId);
  res.json({
    success: true,
  });
}));

router.post('/:id/channel', requireLogin, noPendingMigrations, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  if (checkFields(req, res, ['name'])) {
    d(`Creating new channel: '${req.body.name}' for app: '${req.targetApp.slug}'`);
    const channel = await driver.createChannel(req.targetApp, req.body.name);
    const positioner = new Positioner(store);
    await positioner.initializeStructure(req.targetApp, channel);
    res.json(channel);
    runHooks(req.targetApp, hook => hook.newChannel(channel));
  }
}));

router.get('/:id/channel/:channelId/temporary_releases', requireLogin, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  const channel = await driver.getChannel(req.targetApp, req.params.channelId);
  if (!channel) {
    return res.status(404).json({
      error: 'Channel not found',
    });
  }
  d(`Fetching temporary releases for app: ${req.targetApp.slug} and channel: ${channel.name}`);
  res.json(await driver.getTemporarySaves(req.targetApp, channel));
}));

router.get('/:id/channel/:channelId/temporary_releases/:temporarySaveId/:fileName', requireLogin, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  const channel = await driver.getChannel(req.targetApp, req.params.channelId);
  if (!channel) {
    return res.status(404).json({
      error: 'Channel not found',
    });
  }
  const save = await driver.getTemporarySave(req.params.temporarySaveId);
  if (!save) {
    return res.status(404).json({
      error: 'That temporary save was not found',
    });
  }
  if (!save.filenames.some(fileName => fileName === req.params.fileName)) {
    return res.status(404).json({
      error: 'That fileName could not be found in that temporarySave',
    });
  }

  d(`User: ${req.user.id} requested an unencrypted version of a preRelease file: (${req.targetApp.slug}, ${save.version}, ${req.params.fileName})`);
  const positioner = new Positioner(store);
  const data = await positioner.getTemporaryFile(req.targetApp, save.saveString, req.params.fileName, save.cipherPassword);
  res.setHeader('Content-disposition', `attachment; filename=${req.params.fileName}`);
  res.status(200).write(data);
  res.send();
}));

router.post('/:id/channel/:channelId/temporary_releases/:temporarySaveId/release', requireLogin, noPendingMigrations, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  const channel = await driver.getChannel(req.targetApp, req.params.channelId);
  if (!channel) {
    return res.status(404).json({
      error: 'Channel not found',
    });
  }
  const save = await driver.getTemporarySave(req.params.temporarySaveId);
  if (!save) {
    return res.status(404).json({
      error: 'That temporary save was not found',
    });
  }

  let versionExists = false;
  for (const version of channel.versions) {
    if (version.name === save.version) versionExists = true;
  }

  const positioner = new Positioner(store);
  let storedFileNames: string[];

  if (!(await positioner.withLock(req.targetApp, async (lock) => {
    d(`User: ${req.user.id} promoted a temporary release for app: '${req.targetApp.slug}' on channel: ${channel.name} becomes version: ${save.version}`);

    storedFileNames = await driver.registerVersionFiles(save);
    d(`Tested files: [${save.filenames.join(', ')}] but stored: [${storedFileNames.join(', ')}]`);

    // Get up to date channel
    const upToDateChannel = (await driver.getChannel(req.targetApp, req.params.channelId))!;
    const storedVersion = upToDateChannel.versions.find(v => v.name === save.version)!;
    const storedFiles = storedVersion.files.filter(f => storedFileNames.includes(f.fileName));

    for (const file of storedFiles) {
      d(`Releasing file: ${file.fileName} to version: ${save.version} for (${req.targetApp.slug}/${channel.name})`);

      const data = await positioner.getTemporaryFile(req.targetApp, save.saveString, file.fileName, save.cipherPassword);
      const upToDateFile = await driver.storeSHAs(
        file,
        generateSHAs(data),
      );
      if (upToDateFile) {
        // Use the Hashed file when handling the upload
        storedVersion.files = storedVersion.files.map(f => f.id === upToDateFile.id ? upToDateFile : f);

        await positioner.handleUpload(lock, {
          file: upToDateFile,
          app: req.targetApp,
          channel: upToDateChannel,
          internalVersion: storedVersion,
          fileData: data,
        });
        await positioner.potentiallyUpdateLatestInstallers(
          lock,
          req.targetApp,
          upToDateChannel,
        );
      } else {
        d('Database inconsistency detected while releasing for file:', file.id);
      }
    }
    await positioner.cleanUpTemporaryFile(lock, req.targetApp, save.saveString);
  }))) {
    return res.status(409).json({ error: 'Release already in progress' });
  }

  res.json({ success: true });

  // Run hooks after sending response
  const updatedChannel = await driver.getChannel(req.targetApp, channel.id!);
  if (!updatedChannel) return res.status(400).json({ error: 'Bad channel' });
  const version = updatedChannel.versions.find(version => version.name === save.version);
  if (!version) return;
  if (!versionExists) runHooks(req.targetApp, hook => hook.newVersion(updatedChannel, version));
  if (storedFileNames!.length > 0) {
    runHooks(req.targetApp, hook => hook.newVersionFile(updatedChannel, version));
  }
}));

router.post('/:id/channel/:channelId/temporary_releases/:temporarySaveId/delete', requireLogin, noPendingMigrations, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  const channel = await driver.getChannel(req.targetApp, req.params.channelId);
  if (!channel) {
    return res.status(404).json({
      error: 'Channel not found',
    });
  }
  const save = await driver.getTemporarySave(req.params.temporarySaveId);
  if (!save) {
    return res.status(404).json({
      error: 'That temporary save was not found',
    });
  }

  d(`User: ${req.user.id} deleted a temporary release for app: '${req.targetApp.slug}' on channel: ${channel.name} would have been version: ${save.version} with ${save.filenames.length} files`);
  const positioner = new Positioner(store);
  if (!(await positioner.withLock(req.targetApp, async (lock) => {
    await positioner.cleanUpTemporaryFile(lock, req.targetApp, save.saveString);
    await driver.deleteTemporarySave(save);
  }))) {
    return res.status(409).json({ error: 'Operation already in progress' });
  }

  res.json({ success: true });
}));

router.post('/:id/channel/:channelId/dead', requireLogin, noPendingMigrations, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  const channel = await driver.getChannel(req.targetApp, req.params.channelId);
  if (!channel) {
    return res.status(404).json({
      error: 'Channel not found',
    });
  }

  if (checkFields(req, res, ['version', 'dead'])) {
    const internalVersion = channel.versions.find(v => v.name === req.body.version);
    if (!internalVersion) {
      return res.status(404).json({ error: 'Version not found' });
    }
    const isGreatest = !channel.versions
      .filter(version => version.rollout === 100 && !version.dead)
      .some(version => semver.gt(version.name, internalVersion.name));

    if (isGreatest) {
      d(`User: ${req.user.id} tried to make a version (${req.body.version}) as dead=${req.body.dead} for app: '${req.targetApp.slug}' on channel: ${channel.name}.  But was rejected for safety reasons`);
      return res.status(400).json({ error: 'You can\'t kill the latest version' });
    }
    d(`User: ${req.user.id} marking a version (${req.body.version}) as dead=${req.body.dead} for app: '${req.targetApp.slug}' on channel: ${channel.name}`);

    const updatedChannel = await driver.setVersionDead(req.targetApp, channel, req.body.version, req.body.dead);

    await updateStaticReleaseMetaData(req.targetApp, channel);

    res.json(updatedChannel);
  }
}));

router.get('/:id/channel/:channelId/invalidate-cache', a(async (req, res) => {
  if (stopNoPerms(req, res)) return;

  const channel = await driver.getChannel(req.targetApp, req.params.channelId);
  if (!channel) {
    return res.status(404).json({
      error: 'Channel not found',
    });
  }

  const positioner = new Positioner(store);
  await positioner.withLock(req.targetApp, async (lock) => {
    await positioner.potentiallyUpdateLatestInstallers(
      lock,
      req.targetApp,
      channel,
    );
  });

  await updateStaticReleaseMetaData(req.targetApp, channel);

  res.json({ success: true });
}));

router.post('/:id/channel/:channelId/rollout', requireLogin, noPendingMigrations, a(async (req, res) => {
  if (stopNoPerms(req, res)) return;
  const channel = await driver.getChannel(req.targetApp, req.params.channelId);
  if (!channel) {
    return res.status(404).json({
      error: 'Channel not found',
    });
  }

  if (checkFields(req, res, ['version', 'rollout'])) {
    if (typeof req.body.rollout !== 'number') {
      return res.status(400).json({
        error: 'Rollout % has to be a number',
      });
    }
    const version = channel.versions.find(v => v.name === req.body.version);
    if (!version) {
      return res.status(400).json({
        error: 'Version provided was not found',
      });
    }
    if (version.rollout === 100) {
      return res.status(400).json({
        error: 'You cannot change the rollout of a version once it has reached 100%',
      });
    }
    d(`User: ${req.user.id} changing a version (${req.body.version}) to have a rollout % of '${req.body.rollout}' for app: '${req.targetApp.slug}' on channel: ${channel.name}`);
    const positioner = new Positioner(store);
    const updatedChannel = await driver.setVersionRollout(req.targetApp, channel, req.body.version, req.body.rollout);
    const updatedVersion = updatedChannel.versions.find(v => v.name === req.body.version);
    if (updatedVersion) {
      await positioner.withLock(req.targetApp, async (lock) => {
        await positioner.potentiallyUpdateLatestInstallers(
          lock,
          req.targetApp,
          updatedChannel,
        );
      });
    }
    await updateStaticReleaseMetaData(req.targetApp, updatedChannel);
    res.json(updatedChannel);
  }
}));

router.post('/:id/channel/:channelId/upload', noPendingMigrations, upload.any(), a(async (req, res) => {
  req.setTimeout(uploadTimeout, () => {
    d(`Configured timeout of ${uploadTimeout}ms was exceeded.  Please check the server's "uploadTimeout" configuration for uploads.`);
    return res.status(408).json({
      error: `Request timed out`,
    });
  });
  const token = req.headers.authorization;
  if (token !== req.targetApp.token) {
    return res.status(404).json({
      error: 'Could not find provided channel',
    });
  }
  if (checkFields(req, res, ['version', 'platform', 'arch'])) {
    if (!semver.valid(req.body.version)) {
      return res.status(400).json({
        error: 'Version is not semver compliant',
      });
    }
    if (['darwin', 'linux', 'win32'].indexOf(req.body.platform) !== -1) {
      const channel = await driver.getChannel(req.targetApp, req.params.channelId);
      if (!channel) {
        return res.status(404).json({
          error: 'Could not find provided channel',
        });
      }
      const existingVersion = channel.versions.find(testVersion => testVersion.name === req.body.version);
      const files = req.files as Express.Multer.File[];
      if (existingVersion && existingVersion.files.some(testFile => files.map(file => file.originalname).indexOf(testFile.fileName) !== -1)) {
        return res.status(400).json({
          error: 'Looks like some of those files have already been uploaded',
        });
      }
      const fileNames = files.map(file => file.originalname);
      if ((new Set(fileNames)).size !== fileNames.length) {
        return res.status(400).json({
          error: 'Looks like you tried to upload two or more files with the same file name',
        });
      }
      for (const fileName of fileNames) {
        if (fileName.indexOf(req.body.version) === -1) {
          return res.status(400).json({
            error: `The file name "${fileName}" did not contain the provided version, files uploaded to nucleus must contain the version to ensure cache busting`,
          });
        }
      }
      const temporaryStore = await driver.saveTemporaryVersionFiles(
        req.targetApp,
        channel,
        req.body.version,
        fileNames,
        req.body.arch,
        req.body.platform,
      );
      const positioner = new Positioner(store);
      for (let fileKey = 0; fileKey < files.length; fileKey += 1) {
        const file = files[fileKey];
        await positioner.saveTemporaryFile(req.targetApp, temporaryStore.saveString, file.originalname, file.buffer, temporaryStore.cipherPassword);
      }
      res.json({ success: true });
    } else {
      res.error({
        error: 'Invalid platform provided',
      });
    }
  }
}));

export default router;
