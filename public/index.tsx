import * as React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import { Provider } from 'react-redux';
import { createStore } from 'redux';

import App from './App';
import reducers from './reducers';

import '@atlaskit/css-reset/dist/bundle.css';

const store = createStore(reducers);

render(
  <AppContainer>
    <Provider store={store}>
      <App />
    </Provider>
  </AppContainer>,
  document.querySelector('#app'),
);

if (module && module.hot) {
  module.hot.accept('./App.tsx', () => {
    /* tslint:disable */
    const NewApp = require('./App').default;
  /* tslint:enable */
    render(
      <AppContainer>
        <Provider store={store}>
          <NewApp />
        </Provider>
      </AppContainer>,
      document.querySelector('#app'),
    );
  });
}
