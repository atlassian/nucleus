import SequelizeDriver from './sequelize/SequelizeDriver';

import { dbStrategy } from '../config';
import { IDBDriver } from './BaseDriver';

let driver: IDBDriver;

switch (dbStrategy) {
  case 'sequelize':
  default:
    driver = new SequelizeDriver();
    break;
}

export default driver;
