import * as chai from 'chai';

const chaiHttp = require('chai-http');

chai.use(chaiHttp);

describe('Rest API', () => {
  require('./healthcheck_spec');
  require('./app_spec');
  require('./channel_spec');
  require('./webhook_spec');
});
