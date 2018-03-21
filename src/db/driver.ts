import SequelizeDriver from './sequelize/SequelizeDriver';

import { dbStrategy } from '../config';
import BaseDriver from './BaseDriver';

let driver: BaseDriver;

switch (dbStrategy) {
  case 'sequelize':
  default:
    driver = new SequelizeDriver();
    break;
}

export default driver;
