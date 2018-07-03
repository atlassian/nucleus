import * as chai from 'chai';

import * as helpers from './_helpers';

const { expect } = chai;

describe('healthcheck endpoints', () => {
  before(helpers.startTestNucleus);

  describe('/healthcheck', () => {
    describe('GET', () => {
      it('should respond 200 OK', async () => {
        const response = await helpers.request
          .get('/healthcheck')
          .send();

        expect(response).to.have.status(200);
      });

      it('should response with a JSON body', async () => {
        const response = await helpers.request
          .get('/healthcheck')
          .send();
        
        expect(response).to.be.json;
        expect(response.body).to.deep.equal({ alive: true });
      });
    });
  });

  describe('/deepcheck', () => {
    describe('GET', () => {
      it('should respond 200 OK', async () => {
        const response = await helpers.request
          .get('/deepcheck')
          .send();
        
        expect(response).to.have.status(200);
      });

      it('should respond with a JSON body', async () => {
        const response = await helpers.request
          .get('/deepcheck')
          .send();
        
        expect(response).to.be.json;
        expect(response.body).to.deep.equal({ alive: true });
      });
    });
  });

  after(helpers.stopTestNucleus);
});
