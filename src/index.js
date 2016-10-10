import React from 'react'
import { render } from 'react-dom'
import { createStore, applyMiddleware, compose } from 'redux'
import { Provider } from 'react-redux'
import App from './containers/App'
import reducer from './reducers'
import 'todomvc-app-css/index.css'

import * as types from './constants/ActionTypes'
import GunMiddleware from './GunMiddleware';
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
/*global Gun*/
/*eslint no-undef: "off"*/
const gun = Gun('http://localhost:8080/gun');

const store = createStore(
  reducer,
  composeEnhancers(applyMiddleware(GunMiddleware(gun, [
    {
      path: '/todos',
      actions: {
        remove: doc => { return { type: types.DELETE_TODO, id: doc.id } },
        insert: doc => { return { type: types.INSERT_TODO, todo: doc } },
        update: doc => { return { type: types.UPDATE_TODO, todo: doc } },
      }
    }
  ])))
);

render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
);
