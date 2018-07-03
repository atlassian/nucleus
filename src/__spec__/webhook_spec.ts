import * as chai from 'chai';

import * as helpers from './_helpers';

const { expect } = chai;

describe('webbhook endpoints', () => {
  before(helpers.startTestNucleus);

  let app: NucleusApp;

  before(async () => {
    app = await helpers.createApp();
  });

  describe('/app/:id/webhook', () => {
    describe('POST', () => {
      it('should error if no url is provided', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/webhook`);

        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Missing required body param: "url"');
      });

      it('should error if no secret is provided', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/webhook`)
          .send({
            url: 'fake',
          });

        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Missing required body param: "secret"');
      });

      it('should error if a non string is provided', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/webhook`)
          .send({
            url: [],
            secret: 'cats',
          });

        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Invalid URL provided');
      });

      it('should error if an invalid URL protocol is provided', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/webhook`)
          .send({
            url: 'file://magic',
            secret: 'cats',
          });

        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Invalid URL provided');
      });

      it('should error if a localhost URL is provided', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/webhook`)
          .send({
            url: 'http://localhost',
            secret: 'cats',
          });

        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Invalid URL provided');
      });

      it('should error if a 127.0.0.1 URL is provided', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/webhook`)
          .send({
            url: 'http://127.0.0.1',
            secret: 'cats',
          });

        expect(response).to.have.status(400);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Invalid URL provided');
      });

      it('should succeed if a valid url and secret are provided', async function () {
        this.timeout(4000);

        const response = await helpers.request
          .post(`/app/${app.id}/webhook`)
          .send({
            url: 'https://httpbin.org/post',
            secret: 'cats',
          });

        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body).to.have.property('success', true);
        expect(response.body.hook).to.have.property('secret', 'cats');
        expect(response.body.hook).to.have.property('url', 'https://httpbin.org/post');
      });
    });
  });

  describe('/app/:id/webhook/:webhookId', () => {
    describe('DELETE', () => {
      it('should error if the webhook does not exist', async function () {
        this.timeout(4000);

        const response = await helpers.request
          .del(`/app/${app.id}/webhook/100`);

        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Not Found');
      });

      it('should unregister a valid webhook', async function () {
        this.timeout(4000);

        const response = await helpers.request
          .del(`/app/${app.id}/webhook/1`);

        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body).to.deep.equal({ success: true });
      });

      it('should fail to unregister an already unregistered webhook', async () => {
        const response = await helpers.request
          .del(`/app/${app.id}/webhook/1`);

        expect(response).to.have.status(404);
        expect(response).to.be.json;
        expect(response.body.error).to.equal('Not Found');
      });
    });
  });

  after(helpers.stopTestNucleus);
});
