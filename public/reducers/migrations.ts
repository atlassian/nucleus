import * as actions from '../actions/migrations';

const INITIAL_STATE = {
  items: [],
  hasPendingMigration: false,
};

export const migrations =  (state: MigrationSubState = INITIAL_STATE, action) => {
  switch (action.type) {
    case actions.SET_MIGRATIONS:
      return {
        items: action.migrations,
        hasPendingMigration: !!action.migrations.find(migration => !migration.complete),
      };
  }
  return state;
};
