'use strict';

const assert = require('assert');

const parallel = require('mocha.parallel');
const Aigle = require('../../');

parallel('promisifyAll', () => {

  it('should extend an instance', () => {
    class Test {
      constructor() {
        this._value = undefined;
      }
      set(value, callback) {
        setImmediate(() => {
          this._value = value;
          callback();
        });
      }
      get(callback) {
        setImmediate(() => callback(null, this._value));
      }
    }
    const test = new Test();
    test.put = () => {};
    Aigle.promisifyAll(test);
    assert.ok(test.setAsync);
    assert.ok(test.getAsync);
    assert.ok(test.putAsync);
  });

  it('should extend redis sample', () => {
    const test = 'test';
    function RedisClient() {}
    RedisClient.prototype.get = function(key, callback) {
      callback(null, `${key}_${test}`);
    };
    RedisClient.test = function() {};
    const redis = {
      RedisClient: RedisClient,
      test: function() {}
    };
    Aigle.promisifyAll(redis);
    assert.strictEqual(typeof redis.RedisClient.prototype.getAsync, 'function');
    assert.strictEqual(typeof redis.RedisClient.testAsync, 'function');
    const client = new RedisClient();
    const key = 'key';
    return client.getAsync(key)
      .then(value => assert.strictEqual(value, `${key}_${test}`));
  });

  it('should throw an error if suffix is invalid', () => {

    let error;
    const obj = {
      get: () => {},
      getAsync: () => {}
    };
    try {
      Aigle.promisifyAll(obj);
    } catch (e) {
      error = e;
    }
    assert.ok(error);
  });

  it('should not affect getter/setter', () => {
    const obj = {
      _value: undefined,
      get value() {
        return this._value;
      },
      set value(value) {
        this._value = value + 10;
      }
    };
    const promisified = Aigle.promisifyAll(obj);
    assert.strictEqual(promisified.getAsync, undefined);
    assert.strictEqual(promisified.setAsync, undefined);
    promisified.value = 10;
    assert.strictEqual(promisified.value, 20);
  });

});
