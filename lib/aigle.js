'use strict';

const { AigleCore, AigleProxy } = require('aigle-core');
const Queue = require('./internal/queue');
const Task = require('./internal/task');
const {
  VERSION,
  INTERNAL,
  errorObj,
  call0,
  call1,
  callThen
} = require('./internal/util');
const queue = new Queue();

class Aigle extends AigleCore {

  /**
   * @param {Function} executor
   */
  constructor(executor) {
    super();
    this._resolved = 0;
    this._value = undefined;
    this._key = undefined;
    this._receiver = undefined;
    this._onFulfilled = undefined;
    this._onRejected = undefined;
    this._receivers = undefined;
    if (executor === INTERNAL) {
      return;
    }
    execute(this, executor);
  }

  /**
   * @return {string}
   */
  toString() {
    return '[object Promise]';
  }

  /**
   * @param {Function} onFulfilled
   * @param {Function} [onRejected]
   * @return {Aigle} Returns an Aigle instance
   */
  then(onFulfilled, onRejected) {
    return addAigle(this, new Aigle(INTERNAL), onFulfilled, onRejected);
  }

  /**
   * @param {Object|Function} onRejected
   * @return {Aigle} Returns an Aigle instance
   * @example
   * return Aigle.reject(new TypeError('error'))
   *   .catch(TypeError, error => console.log(error));
   */
  catch(onRejected) {
    if (arguments.length > 1) {
      let l = arguments.length;
      onRejected = arguments[--l];
      const errorTypes = Array(l);
      while (l--) {
        errorTypes[l] = arguments[l];
      }
      onRejected = createOnRejected(errorTypes, onRejected);
    }
    return addAigle(this, new Aigle(INTERNAL), undefined, onRejected);
  }

  /**
   * @param {Function} handler
   * @return {Aigle} Returns an Aigle instance
   */
  finally(handler) {
    handler = typeof handler !== 'function' ? handler : createFinallyHandler(this, handler);
    return addAigle(this, new Aigle(INTERNAL), handler, handler);
  }

  /**
   * @param {Function} handler
   */
  spread(handler) {
    return addReceiver(this, new Spread(handler));
  }

  all() {
    return this.then(all);
  }

  race() {
    return this.then(race);
  }

  props() {
    return this.then(props);
  }

  parallel() {
    return this.then(parallel);
  }

  /**
   * @param {Function} iterator
   */
  each(iterator) {
    return this.then(value => each(value, iterator));
  }

  /**
   * @alias each
   * @param {Function} iterator
   */
  forEach(iterator) {
    return this.each(iterator);
  }

  /**
   * @param {Function} iterator
   */
  eachSeries(iterator) {
    return this.then(value => eachSeries(value, iterator));
  }

  /**
   * @alias eachSeries
   * @param {Function} iterator
   */
  forEachSeries(iterator) {
    return this.eachSeries(iterator);
  }

  /**
   * @param {number} [limit=8] - if you don't define, the default is 8
   * @param {Function} iterator
   * @example
   * const collection = [1, 5, 3, 4, 2];
   * return Aigle.resolve(collection)
   *   .eachLimit(2, num => {
   *     return new Aigle(resolve => setTimeout(() => {
   *       console.log(num); // 1, 3, 5, 2, 4
   *       resolve(num);
   *     }, num * 10));
   *   });
   *
   * @example
   * const collection = [1, 5, 3, 4, 2];
   * return Aigle.resolve(collection)
   *   .eachLimit(num => {
   *     return new Aigle(resolve => setTimeout(() => {
   *       console.log(num); // 1, 2, 3, 4, 5
   *       resolve(num);
   *     }, num * 10));
   *   });
   */
  eachLimit(limit, iterator) {
    return this.then(value => eachLimit(value, limit, iterator));
  }

  /**
   * @alias eachLimit
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  forEachLimit(limit, iterator) {
    return this.eachLimit(limit, iterator);
  }

  /**
   * @param {Function} iterator
   */
  map(iterator) {
    return this.then(value => map(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  mapSeries(iterator) {
    return this.then(value => mapSeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  mapLimit(limit, iterator) {
    return this.then(value => mapLimit(value, limit, iterator));
  }

  /**
   * @param {Function} iterator
   */
  mapValues(iterator) {
    return this.then(value => mapValues(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  mapValuesSeries(iterator) {
    return this.then(value => mapValuesSeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  mapValuesLimit(limit, iterator) {
    return this.then(value => mapValuesLimit(value, limit, iterator));
  }

  /**
   * @param {Function} iterator
   */
  filter(iterator) {
    return this.then(value => filter(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  filterSeries(iterator) {
    return this.then(value => filterSeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  filterLimit(limit, iterator) {
    return this.then(value => filterLimit(value, limit, iterator));
  }

  /**
   * @param {Function} iterator
   */
  reject(iterator) {
    return this.then(value => reject(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  rejectSeries(iterator) {
    return this.then(value => rejectSeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  rejectLimit(limit, iterator) {
    return this.then(value => rejectLimit(value, limit, iterator));
  }

  /**
   * @param {Function} iterator
   */
  find(iterator) {
    return this.then(value => find(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  findSeries(iterator) {
    return this.then(value => findSeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  findLimit(limit, iterator) {
    return this.then(value => findLimit(value, limit, iterator));
  }

  /**
   * @param {Function} iterator
   */
  pick(iterator) {
    return this.then(value => pick(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  pickSeries(iterator) {
    return this.then(value => pickSeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  pickLimit(limit, iterator) {
    return this.then(value => pickLimit(value, limit, iterator));
  }

  /**
   * @param {Function} iterator
   */
  omit(iterator) {
    return this.then(value => omit(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  omitSeries(iterator) {
    return this.then(value => omitSeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  omitLimit(limit, iterator) {
    return this.then(value => omitLimit(value, limit, iterator));
  }

  /**
   * @param {*} result
   * @param {Function} iterator
   */
  reduce(result, iterator) {
    return this.then(value => reduce(value, result, iterator));
  }

  /**
   * @param {Array|Object} result
   * @param {Function} iterator
   */
  transform(result, iterator) {
    return this.then(value => transform(value, result, iterator));
  }

  /**
   * @param {Array|Object} result
   * @param {Function} iterator
   */
  transformSeries(result, iterator) {
    return this.then(value => transformSeries(value, result, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Array|Object} result
   * @param {Function} iterator
   */
  transformLimit(limit, result, iterator) {
    return this.then(value => transformLimit(value, limit, result, iterator));
  }

  /**
   * @param {Function} iterator
   */
  sortBy(iterator) {
    return this.then(value => sortBy(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  sortBySeries(iterator) {
    return this.then(value => sortBySeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  sortByLimit(limit, iterator) {
    return this.then(value => sortByLimit(value, limit, iterator));
  }

  /**
   * @param {Function} iterator
   */
  some(iterator) {
    return this.then(value => some(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  someSeries(iterator) {
    return this.then(value => someSeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  someLimit(limit, iterator) {
    return this.then(value => someLimit(value, limit, iterator));
  }

  /**
   * @param {Function} iterator
   */
  every(iterator) {
    return this.then(value => every(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  everySeries(iterator) {
    return this.then(value => everySeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  everyLimit(limit, iterator) {
    return this.then(value => everyLimit(value, limit, iterator));
  }

  /**
   * @param {Function} iterator
   */
  concat(iterator) {
    return this.then(value => concat(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  concatSeries(iterator) {
    return this.then(value => concatSeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  concatLimit(limit, iterator) {
    return this.then(value => concatLimit(value, limit, iterator));
  }

  /**
   * @param {Function} iterator
   */
  groupBy(iterator) {
    return this.then(value => groupBy(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  groupBySeries(iterator) {
    return this.then(value => groupBySeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  groupByLimit(limit, iterator) {
    return this.then(value => groupByLimit(value, limit, iterator));
  }

  /**
   * @param {number} ms
   */
  delay(ms) {
    return addReceiver(this, new Delay(ms));
  }

  /**
   * @param {number} ms
   * @param {*} [message]
   */
  timeout(ms, message) {
    return addReceiver(this, new Timeout(ms, message));
  }

  /**
   * @param {Function} tester
   * @param {Function} iterator
   */
  whilst(tester, iterator) {
    return this.then(value => whilst(value, tester, iterator));
  }

  /**
   * @param {Function} iterator
   * @param {Function} tester
   */
  doWhilst(iterator, tester) {
    return this.then(value => doWhilst(value, iterator, tester));
  }

  /**
   * @param {Function} tester
   * @param {Function} iterator
   */
  until(tester, iterator) {
    return this.then(value => until(value, tester, iterator));
  }

  /**
   * @param {Function} iterator
   * @param {Function} tester
   */
  doUntil(iterator, tester) {
    return this.then(value => doUntil(value, iterator, tester));
  }

  /**
   * @param {Function} iterator
   */
  times(iterator) {
    return this.then(value => times(value, iterator));
  }

  /**
   * @param {Function} iterator
   */
  timesSeries(iterator) {
    return this.then(value => timesSeries(value, iterator));
  }

  /**
   * @param {number} [limit=8]
   * @param {Function} iterator
   */
  timesLimit(limit, iterator) {
    return this.then(value => timesLimit(value, limit, iterator));
  }

  /**
   * @param {Function} handler
   */
  disposer(handler) {
    return new Disposer(this, handler);
  }

  /* internal functions */

  _resolve(value) {
    this._resolved = 1;
    this._value = value;
    if (this._receiver === undefined) {
      return;
    }
    const { _receiver } = this;
    this._receiver = undefined;
    if (_receiver instanceof AigleProxy) {
      _receiver._callResolve(value, this._key);
    } else if (this._key === INTERNAL) {
      _receiver._resolve(value);
    } else {
      callResolve(_receiver, this._onFulfilled, value);
    }
    if (!this._receivers) {
      return;
    }
    const { _receivers } = this;
    this._receivers = undefined;
    while (_receivers.head) {
      const { receiver, onFulfilled } = _receivers.shift();
      callResolve(receiver, onFulfilled, value);
    }
  }

  _reject(reason) {
    this._resolved = 2;
    this._value = reason;
    if (this._receiver === undefined) {
      process.emit('unhandledRejection', reason);
      return;
    }
    const { _receiver, _key } = this;
    this._receiver = undefined;
    if (_receiver instanceof AigleProxy) {
      _receiver._callReject(reason);
    } else if (_key === INTERNAL) {
      _receiver._reject(reason);
    } else {
      callReject(_receiver, this._onRejected, reason);
    }
    if (!this._receivers) {
      return;
    }
    const { _receivers } = this;
    this._receivers = undefined;
    while (_receivers.head) {
      const { receiver, onRejected } = _receivers.shift();
      callReject(receiver, onRejected, reason);
    }
  }

  _addAigle(receiver, onFulfilled, onRejected) {
    if (this._receiver === undefined) {
      this._receiver = receiver;
      this._onFulfilled = onFulfilled;
      this._onRejected = onRejected;
      return;
    }
    if (!this._receivers) {
      this._receivers = new Queue();
    }
    this._receivers.push(new Task(undefined, receiver, onFulfilled, onRejected));
  }

  _addReceiver(receiver, key) {
    this._key = key;
    this._receiver = receiver;
  }
}

module.exports = { Aigle };

/* functions, classes */
const { all } = require('./all');
const race = require('./race');
const { props } = require('./props');
const parallel = require('./parallel');
const each = require('./each');
const eachSeries = require('./eachSeries');
const eachLimit = require('./eachLimit');
const map = require('./map');
const mapSeries = require('./mapSeries');
const { mapLimit } = require('./mapLimit');
const mapValues = require('./mapValues');
const mapValuesSeries = require('./mapValuesSeries');
const { mapValuesLimit } = require('./mapValuesLimit');
const filter = require('./filter');
const filterSeries = require('./filterSeries');
const { filterLimit } = require('./filterLimit');
const reject = require('./reject');
const rejectSeries = require('./rejectSeries');
const { rejectLimit } = require('./rejectLimit');
const find = require('./find');
const findSeries = require('./findSeries');
const { findLimit } = require('./findLimit');
const pick = require('./pick');
const pickSeries = require('./pickSeries');
const { pickLimit } = require('./pickLimit');
const omit = require('./omit');
const omitSeries = require('./omitSeries');
const { omitLimit } = require('./omitLimit');
const reduce = require('./reduce');
const transform = require('./transform');
const transformSeries = require('./transformSeries');
const transformLimit = require('./transformLimit');
const sortBy = require('./sortBy');
const sortBySeries = require('./sortBySeries');
const sortByLimit = require('./sortByLimit');
const some = require('./some');
const someSeries = require('./someSeries');
const someLimit = require('./someLimit');
const every = require('./every');
const everySeries = require('./everySeries');
const everyLimit = require('./everyLimit');
const concat = require('./concat');
const concatSeries = require('./concatSeries');
const concatLimit = require('./concatLimit');
const groupBy = require('./groupBy');
const groupBySeries = require('./groupBySeries');
const groupByLimit = require('./groupByLimit');
const { join, Spread } = require('./join');
const { delay, Delay } = require('./delay');
const Timeout = require('./timeout');
const { whilst } = require('./whilst');
const { doWhilst } = require('./doWhilst');
const { until } = require('./until');
const doUntil = require('./doUntil');
const retry = require('./retry');
const times = require('./times');
const timesSeries = require('./timesSeries');
const timesLimit = require('./timesLimit');
const { using, Disposer } = require('./using');

Aigle.VERSION = VERSION;

/* core functions */
Aigle.resolve = _resolve;
Aigle.reject = _reject;

/* collections */
Aigle.all = all;
Aigle.race = race;
Aigle.props = props;
Aigle.parallel = parallel;
Aigle.each = each;
Aigle.eachSeries = eachSeries;
Aigle.eachLimit = eachLimit;
Aigle.forEach = each;
Aigle.forEachSeries = eachSeries;
Aigle.forEachLimit = eachLimit;
Aigle.map = map;
Aigle.mapSeries = mapSeries;
Aigle.mapLimit = mapLimit;
Aigle.mapValues = mapValues;
Aigle.mapValuesSeries = mapValuesSeries;
Aigle.mapValuesLimit = mapValuesLimit;
Aigle.filter = filter;
Aigle.filterSeries = filterSeries;
Aigle.filterLimit = filterLimit;
Aigle.rejectSeries = rejectSeries;
Aigle.rejectLimit = rejectLimit;
Aigle.find = find;
Aigle.findSeries = findSeries;
Aigle.findLimit = findLimit;
Aigle.detect = find;
Aigle.detectSeries = findSeries;
Aigle.detectLimit = findLimit;
Aigle.pick = pick;
Aigle.pickSeries = pickSeries;
Aigle.pickLimit = pickLimit;
Aigle.omit = omit;
Aigle.omitSeries = omitSeries;
Aigle.omitLimit = omitLimit;
Aigle.reduce = reduce;
Aigle.transform = transform;
Aigle.transformSeries = transformSeries;
Aigle.transformLimit = transformLimit;
Aigle.sortBy = sortBy;
Aigle.sortBySeries = sortBySeries;
Aigle.sortByLimit = sortByLimit;
Aigle.some = some;
Aigle.someSeries = someSeries;
Aigle.someLimit = someLimit;
Aigle.every = every;
Aigle.everySeries = everySeries;
Aigle.everyLimit = everyLimit;
Aigle.concat = concat;
Aigle.concatSeries = concatSeries;
Aigle.concatLimit = concatLimit;
Aigle.groupBy = groupBy;
Aigle.groupBySeries = groupBySeries;
Aigle.groupByLimit = groupByLimit;

Aigle.join = join;
Aigle.promisify = require('./promisify');
Aigle.promisifyAll = require('./promisifyAll');
Aigle.delay = delay;
Aigle.whilst = whilst;
Aigle.doWhilst = doWhilst;
Aigle.until = until;
Aigle.doUntil = doUntil;
Aigle.retry = retry;
Aigle.times = times;
Aigle.timesSeries = timesSeries;
Aigle.timesLimit = timesLimit;
Aigle.using = using;

/* errors */
const { TimeoutError } = require('./error');
Aigle.TimeoutError = TimeoutError;

function _resolve(value) {
  const promise = new Aigle(INTERNAL);
  promise._resolved = 1;
  promise._value = value;
  return promise;
}

function _reject(reason, iterator) {
  if (arguments.length === 2 && typeof iterator === 'function') {
    return reject(reason, iterator);
  }
  const promise = new Aigle(INTERNAL);
  promise._resolved = 2;
  promise._value = reason;
  return promise;
}

module.exports = Aigle;

function execute(promise, executor) {
  try {
    executor(resolve, reject);
  } catch(e) {
    reject(e);
  }

  function resolve(value) {
    if (promise._resolved !== 0) {
      return;
    }
    promise._resolve(value);
  }

  function reject(reason) {
    if (promise._resolved !== 0) {
      return;
    }
    promise._reject(reason);
  }
}

function callResolve(receiver, onFulfilled, value) {
  if (typeof onFulfilled !== 'function') {
    receiver._resolve(value);
    return;
  }
  const promise = call1(onFulfilled, value);
  if (promise === errorObj) {
    receiver._reject(errorObj.e);
    return;
  }
  if (promise instanceof AigleCore) {
    switch (promise._resolved) {
    case 0:
      promise._addReceiver(receiver, INTERNAL);
      return;
    case 1:
      receiver._resolve(promise._value);
      return;
    case 2:
      receiver._reject(promise._value);
      return;
    }
  }
  if (promise && promise.then) {
    callThen(promise, receiver);
  } else {
    receiver._resolve(promise);
  }
}

function callReject(receiver, onRejected, reason) {
  if (typeof onRejected !== 'function') {
    receiver._reject(reason);
    return;
  }
  const promise = call1(onRejected, reason);
  if (promise === errorObj) {
    receiver._reject(errorObj.e);
    return;
  }
  if (promise instanceof AigleCore) {
    switch (promise._resolved) {
    case 0:
      promise._addReceiver(receiver, INTERNAL);
      return;
    case 1:
      receiver._resolve(promise._value);
      return;
    case 2:
      receiver._reject(promise._value);
      return;
    }
  }
  if (promise && promise.then) {
    callThen(promise, receiver);
  } else {
    receiver._resolve(promise);
  }
}

function createOnRejected(errorTypes, onRejected) {
  return reason => {
    let l = errorTypes.length;
    while (l--) {
      if (reason instanceof errorTypes[l]) {
        return onRejected(reason);
      }
    }
    return Aigle.reject(reason);
  };
}

function createFinallyHandler(promise, handler) {
  return () => {
    const { _resolved, _value } = promise;
    const p = call0(handler);
    if (p === errorObj) {
      return p;
    }
    if (p instanceof AigleCore) {
      switch (p._resolved) {
      case 1:
        p._value = _value;
        return p;
      case 2:
        return p;
      }
    }
    const receiver = new Aigle(INTERNAL);
    if (!p || !p.then) {
      receiver._resolved = _resolved;
      receiver._value = _value;
    } else if (_resolved === 1) {
      p.then(() => receiver._resolve(_value), reason => receiver._reject(reason));
    } else {
      p.then(() => receiver._reject(_value), reason => receiver._reject(reason));
    }
    return receiver;
  };
}

function tick() {
  while (queue.head) {
    const task = queue.shift();
    const { promise, receiver } = task;
    const { _resolved, _value } = promise;
    if (_resolved === 1) {
      if (receiver instanceof AigleProxy) {
        receiver._callResolve(_value, promise._key);
      } else {
        callResolve(receiver, task.onFulfilled, _value);
      }
    } else {
      if (receiver instanceof AigleProxy) {
        receiver._callReject(_value, promise._key);
      } else {
        callReject(receiver, task.onRejected, _value);
      }
    }
  }
}

function push(promise, receiver, onFulfilled, onRejected) {
  if (!queue.head) {
    setImmediate(tick);
  }
  queue.push(new Task(promise, receiver, onFulfilled, onRejected));
}

function addAigle(promise, receiver, onFulfilled, onRejected) {
  if (promise._resolved === 0) {
    promise._addAigle(receiver, onFulfilled, onRejected);
  } else {
    push(promise, receiver, onFulfilled, onRejected);
  }
  return receiver;
}

function addReceiver(promise, receiver) {
  if (promise._resolved === 0) {
    promise._addReceiver(receiver);
  } else {
    push(promise, receiver);
  }
  return receiver._promise;
}
