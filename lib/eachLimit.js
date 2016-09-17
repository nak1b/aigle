'use strict';

const util = require('./internal/util');
const DummyPromise = require('./internal/dummyPromise');
const errorObj = util.errorObj;
const tryCatch = util.tryCatchWithKey;

module.exports = Promise => {

  return function eachLimit(collection, n, iterator) {
    if (arguments.length === 2) {
      iterator = n;
      n = util.concurrency;
    }
    let size;
    let rest;
    let keys;
    let _iterator;
    let index = -1;
    let called = false;
    const promise = new Promise(util.noop);
    const _callResolve = promise._callResolve;
    const _callReject = promise._callReject;
    const callResolve = () => {
      if (--size === 0) {
        _iterator = util.noop;
        _callResolve();
      } else {
        _iterator();
      }
    };
    const callReject = reason => {
      if (called) {
        return;
      }
      called = true;
      _callReject(reason);
    };
    const dummy = new DummyPromise(callResolve, callReject);

    if (Array.isArray(collection)) {
      size = collection.length;
      _iterator = () => {
        if (--rest < 0) {
          return;
        }
        const p = tryCatch(iterator, collection[++index], index);
        if (p === errorObj) {
          promise._resolved = 2;
          promise._value = p.e;
          return util.callReject(promise._child, p.e);
        }
        if (p instanceof Promise) {
          p._child = dummy;
          p._resume();
          return;
        }
        if (p && p.then) {
          p.then(callResolve, callReject);
        } else {
          callResolve();
        }
      };
    } else if (!collection) {
    } else if (typeof collection === 'object') {
      keys = Object.keys(collection);
      size = keys.length;
      _iterator = () => {
        if (--rest < 0) {
          return;
        }
        const key = keys[++index];
        const p = tryCatch(iterator, collection[key], key);
        if (p === errorObj) {
          promise._resolved = 2;
          promise._value = p.e;
          return util.callReject(promise._child, p.e);
        }
        if (p instanceof Promise) {
          p._child = dummy;
          p._resume();
          return;
        }
        if (p && p.then) {
          p.then(callResolve, callReject);
        } else {
          callResolve();
        }
      };
    }
    rest = size;
    if (size === undefined) {
      promise._resolved = 1;
    } else {
      n = Math.min(n, size);
      util.times(n, _iterator);
    }
    return promise;
  };
};