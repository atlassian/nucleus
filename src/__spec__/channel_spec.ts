import * as chai from 'chai';

import * as helpers from './_helpers';

const { expect } = chai;

describe('channel endpoints', () => {
  before(helpers.startTestNucleus);
  after(helpers.stopTestNucleus);

  describe('/app/:id/channel', () => {
    describe('POST', () => {
      let app: NucleusApp;

      before(async () => {
        app = await helpers.createApp();
      });

      it('should error if an invalid app ID is provided', async () => {
        const response = await helpers.request
          .post('/app/10000/channel');
        
        expect(response).to.have.status(404);
        expect(response.body.error).to.equal('App not found');
      });

      it('should error if no name is provided', async () => {
        const response = await helpers.request
          .post(`/app/${app.id}/channel`);

        expect(response).to.have.status(400);
        expect(response.body.error).to.equal('Missing required body param: "name"');
      });

      it('should create the channel when a name is provided', async function () {
        this.timeout(60000);

        const response = await helpers.request
          .post(`/app/${app.id}/channel`)
          .send({
            name: 'Stable',
          });

        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body).to.have.property('name', 'Stable');
        expect(response.body.versions).to.deep.equal([], 'should have no versions');

        expect(await helpers.store.hasFile(`${app.slug}/${response.body.id}/versions.json`))
          .to.equal(true, 'should create the versions.json file for the channel');

        expect(await helpers.store.hasFile(`${app.slug}/${response.body.id}/linux/${app.slug}.repo`))
          .to.equal(true, 'should create the redhat repo file');

        expect(await helpers.store.hasFile(`${app.slug}/${response.body.id}/linux/debian/binary/Release`))
          .to.equal(true, 'should create the debian apt repo metadata');

        expect(await helpers.store.hasFile(`${app.slug}/${response.body.id}/linux/redhat/repodata/repomd.xml`))
          .to.equal(true, 'should create the redhat yum repo metadata');
      });

      it('should persist the created channel in the /app/:id endpoint', async () => {
        const response = await helpers.request
          .get(`/app/${app.id}`);

        expect(response).to.have.status(200);
        expect(response).to.be.json;
        expect(response.body.channels).to.have.lengthOf(1);
        expect(response.body.channels[0].name).to.equal('Stable');
      });
    });
  });
});
