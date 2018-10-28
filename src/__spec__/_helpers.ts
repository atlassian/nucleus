import * as chai from 'chai';
import * as cp from 'child_process';
import * as fs from 'fs-extra';
import * as http from 'http';
import * as path from 'path';

import LocalStore from '../files/local/LocalStore';

const serveHandler = require('serve-handler');

let child: cp.ChildProcess | null = null;
let server: http.Server | null = null;

export const startTestNucleus = async function (this: any) {
  this.timeout(7000);

  if (child !== null || server !== null) {
    throw new Error('Nucleus is already running, something went wrong in the tests');
  }
  await fs.remove(path.resolve(__dirname, 'fixtures', '.files'));
  await fs.remove(path.resolve(__dirname, 'fixtures', 'test.sqlite'));

  child = cp.spawn(
    process.execPath,
    [
      path.resolve(__dirname, '../../lib/index.js'),
      path.resolve(__dirname, './fixtures/test.config.js'),
    ],
    {
      cwd: path.resolve(__dirname, '..'),
      env: Object.assign({}, process.env, {
        DEBUG: 'nucleus*',
        UNSAFELY_DISABLE_NUCLEUS_AUTH: 'true',
      }),
      stdio: 'inherit',
    },
  );
  server = http.createServer((req, res) => {
    return serveHandler(req, res, {
      public: path.resolve(__dirname, 'fixtures/.files'),
    });
  });
  await new Promise(resolve => server!.listen(9999, () => resolve()));
  let alive = false;
  while (!alive) {
    try {
      await request.get('/').send();
      alive = true;
    } catch {
      // Ignore
    }
  }
};

export const stopTestNucleus = async () => {
  if (child) {
    const waiter = new Promise(resolve => child!.on('exit', () => resolve()));
    child.kill();
    await waiter;
    child = null;
  }
  if (server) {
    await new Promise(resolve => server!.close(() => resolve()));
    server = null;
  }
  await fs.remove(path.resolve(__dirname, 'fixtures', '.files'));
  await fs.remove(path.resolve(__dirname, 'fixtures', 'test.sqlite'));
};

export const request = chai.request('http://localhost:8987/rest');

export const store = new LocalStore({
  root: path.resolve(__dirname, 'fixtures', '.files'),
  staticUrl: 'http://localhost:9999',
});

export const createApp = async (): Promise<NucleusApp> => {
  const response = await request
    .post('/app')
    .field('name', 'Test App')
    .attach('icon', fs.createReadStream(path.resolve(__dirname, 'fixtures', 'icon.png')));
  
  return response.body;
};
