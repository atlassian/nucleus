import * as actions from '../actions/user';

const INITIAL_STATE = {
  signedIn: false,
};

export const user =  (state: UserSubState = INITIAL_STATE, action) => {
  let newState: UserSubState = state;
  switch (action.type) {
    case actions.LOG_OUT:
      newState = INITIAL_STATE;
      break;
    case actions.SET_USER:
      newState = {
        user: action.user,
        signedIn: !!action.user,
      };
      break;
  }
  return newState;
};
