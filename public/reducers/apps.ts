import * as actions from '../actions/apps';

const INITIAL_STATE = null;

export const apps =  (state: AppsSubState = INITIAL_STATE, action) => {
  let newState: AppsSubState = state;
  switch (action.type) {
    case actions.SET_APPS:
      if (Array.isArray(action.apps)) {
        newState = action.apps;
      } else {
        newState = state.concat(action.apps);
      }
      break;
  }
  return newState;
};
