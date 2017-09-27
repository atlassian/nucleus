export const LOG_OUT = 'LOG_OUT';
export const SET_USER = 'SET_USER';

export const setUser = (user: User) => ({
  user,
  type: SET_USER,
});

export const logOut = () => ({
  type: LOG_OUT,
});
