import * as actions from '../actions/base';

const INITIAL_STATE = '';

export const base =  (state: string = INITIAL_STATE, action) => {
  switch (action.type) {
    case actions.SET_BASE_UPDATE_URL:
      return action.url;
  }
  return state;
};
