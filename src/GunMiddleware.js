/**
 * Created by Paul on 10/7/2016.
 * inspired by https://github.com/pgte/pouch-redux-middleware
 * TODO: issue: stores duplicates in an object path.docs for removing redundant operations
 * can be implemented with redux history, but same lot of data
 * to test checking with gun, don't know how, yet
 * another method is eventually to store timestamps (updated_at) in redux and only that in path.docs
 */
/*global Gun*/
/*eslint no-undef: "off"*/

import jPath from 'json-path';
import equal from 'deep-equal';
import extend from 'xtend';

export default function GunMiddleware(gun, _options) {
  // let count = 1;
  // let countMap = 1;
  // let countState = 1;
  let paths = _options || [];

  if (! paths.length) {
    throw new Error('GunMiddleware: no paths');
  }

  const defaultSpec = {
    path: '.',
    remove,
    put,
    reduxRemove,
    reduxUpdate,
    reduxInsert,
    docs: {},
    actions: {
      remove: defaultAction('remove'),
      update: defaultAction('update'),
      insert: defaultAction('insert')
    }
  };

  let gunner = {};
  paths = paths.map(function(path) {
    let spec = extend({}, defaultSpec, path);
    spec.actions = extend({}, defaultSpec.actions, spec.actions);
    spec.docs = {};
    gunner[path.path] = gun.get(path.path.slice(1));
    return spec;
  });

  function toRedux(val, id, db, ret, done) {
    //reentering in Gun
    let base = Gun.is(val) ? val : db.path(id);

    //can't use `base` as I can't get values. Why?
    let keys = Object.keys(val);
    keys.shift();

    if(val["["]) {
      keys.shift();
      let arr = [];
      let pending = keys.length;
      keys.forEach(function (key) {
        let current = val[key];
        if (current['#']) {
          base.path(key).val(function (value) {
            toRedux(value, key, base, {}, function (res) {
              res['['] = key;
              arr.push(res);
              if (!--pending) done(arr);
            });
          });
        }
        else {
          arr.push(current);
        }
        ret[id] = arr;
      });
    }
    else {
      let pending = keys.length;
      keys.forEach(function (key) {
        let current = val[key];
        if (current && current['#']) {
          base.path(key).val(function (value) {
            if(value === null) {
              ret[key] = null;
              if (!--pending) done(ret);
              return;
            }
            toRedux(value, key, base, {}, function (res) {
              ret[key] = res;
              if (!--pending) done(ret);
            });
          });
        }
        else {
          ret[key] = current;
          if (!--pending) done(ret);
        }
      });
    }
  }

  function array2object(arr) {
    var obj = { "[": true };
    Gun.list.map(arr, function (v, f, t) {
      if (Gun.list.is(v)) {
        obj[Gun.text.random()] = array2object(v);
        return;
      }
      if (Gun.obj.is(v) && v !== null) {
        let key = v['['];
        let val = extend({}, v);
        delete val['['];
        obj[key] = toGun(val);
        return;
      }
      if(v === false) {
        ret[key] = v;
        return;
      }
      obj[Gun.text.random()] = v || null;
    });
    return obj;
  }

  function toGun(val) {
    let ret = {};
    let keys = Object.keys(val);
    keys.forEach(function (key) {
      let crt = val[key];
      if(Gun.list.is(crt)) {
        ret[key] = array2object(crt);
        return;
      }
      if(Gun.obj.is(crt) && crt !== null) {
        ret[key] = toGun(crt);
        return;
      }
      if(crt === false) {
        ret[key] = crt;
        return;
      }
      ret[key] = crt || null;
    });
    delete ret.id;
    return ret;
  }

  function listen(path, dispatch) {
    let db = gunner[path.path];
    db.map(function (val, id) {
      // console.log('map: ', count++, countMap++);
      if(! val) {
        if(path.docs[id]) {
          // delete path.docs[id]; //useful? or in fact generates issues?
          return path.reduxRemove({ id }, dispatch);
        }
        else return void 0;
      }

      return toRedux(val, id, db, { id }, function(result) {
        onDbChange(path, result, dispatch)
      });
    });
  }

  function processNewStateForPath(path, state) {
    let db = gunner[path.path];
    let docs = jPath.resolve(state, path.path);
    if (docs && docs.length) {
      docs.forEach(function(docs) {
        // console.log('each: ', count++, countState++);
        let diffs = differences(path.docs, docs);
        diffs.put.forEach(doc => path.put(doc, db, path));
        diffs.deleted.forEach(doc => path.remove(doc, db, path));
      });
    }
  }

  function put(doc, db, path) {
    path.docs[doc.id] = extend({}, doc );
    let toPut = toGun(doc)
    db.path(doc.id).put(toPut);
  }

  function remove(doc, db, path) {
    delete path.docs[doc.id];
    db.path(doc.id).put(null);
  }

  function reduxRemove(doc, dispatch) {
    dispatch(this.actions.remove(doc));
  }

  function reduxInsert(doc, dispatch) {
    dispatch(this.actions.insert(doc));
  }

  function reduxUpdate(doc, dispatch) {
    dispatch(this.actions.update(doc));
  }

  const middleware = store => {
    paths.forEach((path) => listen(path, store.dispatch));
    return next => action => {
      let returnValue = next(action);
      let newState = store.getState();
      paths.forEach(path => processNewStateForPath(path, newState));
      return returnValue;
    }
  };
  return middleware;
}

function differences(oldDocs, newDocs) {
  let result = {
    put: [],
    deleted: Object.keys(oldDocs).map(oldDocId => oldDocs[oldDocId]),
  };

  newDocs.forEach(function(newDoc) {
    let id = newDoc.id;
    if (! id) {
      warn('doc with no id');
    }
    result.deleted = result.deleted.filter(doc => doc.id !== id);
    let oldDoc = oldDocs[id];
    if (! oldDoc || ! equal(oldDoc, newDoc)) {
      result.put.push(newDoc);
    }
  });

  return result;
}

function onDbChange(path, changed, dispatch) {
  let changeDoc = changed;
  if(path.changeFilter && (! path.changeFilter(changeDoc))) {
    return;
  }
  let oldDoc = path.docs[changeDoc.id];
  path.docs[changeDoc.id] = extend({}, changeDoc );
  if (oldDoc) {
    if(! equal(oldDoc, changeDoc)) {
      path.reduxUpdate(changeDoc, dispatch);
    }
  } else {
    path.reduxInsert(changeDoc, dispatch);
  }
}

function warn(what) {
  let fn = console.warn || console.log;
  if (fn) {
    fn.call(console, what);
  }
}

function defaultAction(action) {
  return function() {
    throw new Error('no action provided for ' + action);
  };
}
