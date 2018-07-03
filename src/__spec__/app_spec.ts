import * as chai from 'chai';
import * as fs from 'fs-extra';
import * as path from 'path';

import * as helpers from './_helpers';

const { expect } = chai;

describe('app endpoints', () => {
  before(helpers.startTestNucleus);
  after(helpers.stopTestNucleus);

  describe('/app', () => {
    describe('POST', () => {
      it('should error if no name is provided', async () => {
        const response = await helpers.request
          .post('/app');

        expect(response).to.have.status(400);
        expect(response.body.error).to.equal('Missing required body param: "name"');
      });

      it('should error if an empty name is provided', async () => {
        const response = await helpers.request
          .post('/app')
          .field('name', '');

        expect(response).to.have.status(400);
        expect(response.body.error).to.equal('Your app name can not be an empty string');
      });

      it('should error if no icon is provided', async () => {
        const response = await helpers.request
          .post('/app')
          .field('name', 'Test App');

        expect(response).to.have.status(400);
        expect(response.body.error).to.equal('Missing icon file');
      });

      it('should error if a reserved name is provided', async () => {
        const response = await helpers.request
          .post('/app')
          .field('name', '__healthcheck');

        expect(response).to.have.status(400);
        expect(response.body.error).to.equal('You can not call your application __healthcheck');
      });

      it('should create an app with valid params', async () => {
        const response = await helpers.request
          .post('/app')
          .field('name', 'Test App')
          .attach('icon', fs.createReadStream(path.resolve(__dirname, 'fixtures', 'icon.png')));

        expect(response).to.have.status(200);
        expect(response.body).to.have.property('name', 'Test App');
        expect(response.body).to.have.property('slug', 'Test-App', 'should sanitize the name into a slug');
        expect(response.body.team).to.deep.equal(['charlie'], 'the initial team should just be charlie');
        expect(response.body.channels).to.deep.equal([], 'should have no channels initially');
        expect(response.body.webHooks).to.deep.equal([], 'should have no webhooks initially');
        expect(response.body.token).to.have.length.greaterThan(0, 'should have a non zero length random string token');
      });

      it('should create an app with de-duped slug if the same app name already exists', async () => {
        const response = await helpers.request
          .post('/app')
          .field('name', 'Test App')
          .attach('icon', fs.createReadStream(path.resolve(__dirname, 'fixtures', 'icon.png')));
        
        expect(response).to.have.status(200);
        expect(response.body).to.have.property('slug', 'Test-App2', 'should dedupe the name into a slug');
      });

      it('should put the app icon in a known position in the file store', async () => {
        expect(await helpers.store.hasFile('Test-App/icon.png')).to.equal(true);
        expect(await helpers.store.getFile('Test-App/icon.png')).to.deep.equal(
          await fs.readFile(path.resolve(__dirname, 'fixtures', 'icon.png')),
        );
      });

      it('should convert the app icon to a .ico file and put it in a known position in the file store', async () => {
        expect(await helpers.store.hasFile('Test-App/icon.ico')).to.equal(true);
      });
    });

    describe('GET', () => {
      it('should list all the apps', async () => {
        const response = await helpers.request
          .get('/app');

        expect(response).to.be.json;
        expect(response.body).to.have.lengthOf(2);
        expect(response.body[0]).to.have.property('slug', 'Test-App');
        expect(response.body[1]).to.have.property('slug', 'Test-App2');
      });
    });
  });

  describe('/app/:id', () => {
    describe('GET', () => {
      it('should return not found when given an invalid app ID', async () => {
        const response = await helpers.request
          .get('/app/500');

        expect(response).to.have.status(404);
        expect(response).to.be.json;
      });

      it('should return the app when given a valid app ID', async () => {
        const app = await helpers.createApp();
        const response = await helpers.request
          .get(`/app/${app.id}`);

        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body).to.deep.equal(app);
      });
    });
  });

  describe('/app/:id/icon', () => {
    describe('POST', () => {
      let app: NucleusApp;

      before(async () => {
        app = await helpers.createApp();
      });

      it('should error if no icon is provided', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/icon`);

        expect(response).to.have.status(400);
        expect(response.body.error).to.equal('Missing icon file');
      });

      it('should succeed if an icon is provided', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/icon`)
          .attach('icon', fs.createReadStream(path.resolve(__dirname, 'fixtures', 'icon2.png')));

        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body).to.deep.equal({ success: true });

        expect(await helpers.store.hasFile(`${app.slug}/icon.png`)).to.equal(true);
        expect(await helpers.store.hasFile(`${app.slug}/icon.ico`)).to.equal(true);
        expect(await helpers.store.getFile(`${app.slug}/icon.png`)).to.deep.equal(
          await fs.readFile(path.resolve(__dirname, 'fixtures', 'icon2.png')),
        );
      });
    });
  });

  describe('/app/:id/refresh_token', () => {
    describe('POST', () => {
      let app: NucleusApp;

      before(async () => {
        app = await helpers.createApp();
      });

      it('should regenerate the token for the given app', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/refresh_token`);

        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body.token).to.not.equal(app.token);
      });

      it('should persist the change to the token', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/refresh_token`);

        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body.token).to.not.equal(app.token);
        
        const appResponse = await helpers.request
          .get(`/app/${app.id}`);

        expect(appResponse.body.token).to.equal(response.body.token);
      });
    });
  });

  describe('/app/:id/team', () => {
    describe('POST', () => {
      let app: NucleusApp;

      before(async () => {
        app = await helpers.createApp();
      });

      it('should error if no team is provided', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/team`);

        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Missing required body param: "team"');
      });

      it('should error if the provided team is invalid JSON', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/team`)
          .send({
            team: 'abc[]',
          });

        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Provided parameter "team" is not valid JSON');
      });

      it('should error if the provided team is not an array', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/team`)
          .send({
            team: '"foo"',
          });

        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Bad team');
      });

      it('should error if the provided team does not contain the current user', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/team`)
          .send({
            team: '[]',
          });

        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Bad team');
      });

      it('should update the team when given a valid team', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/team`)
          .send({
            team: '["charlie","test","new"]',
          });

        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body.team.sort()).to.deep.equal(['charlie', 'test', 'new'].sort());
      });

      it('should persist the update to the team when given a valid team', async () => {
        await helpers.request
          .post(`/app/${app.id}/team`)
          .send({
            team: '["charlie","thing"]',
          });

        const response = await helpers.request
          .get(`/app/${app.id}`);

        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body.team.sort()).to.deep.equal(['charlie', 'thing'].sort());
      });
    });
  });
});
