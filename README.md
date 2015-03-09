crisphooks
==========

Simple asynchronous/synchronous hooks for Node.JS and browsers.  Works well with both
promise-based and callback-based architectures.

## Changes in 2.0

CrispHooks 2.0 contains an API overhaul to make the library more friendly to promise-based
structures.  Upgrading old callback-based code to use CrispHooks 2.0 may require changing
plain calls to `.hook()` and `.trigger()` to `.hookSync()`, `.hookAsync()`, `.triggerSync()`,
or `.triggerAsync()`.  The functions `.hook()` and `.trigger()` now utilize promises.

## Installing

```
npm install crisphooks
```

## Asynchronous or Synchronous Hooks

Hooks registered using the `hook()` method can either return scalar values or Promises.
If it returns a Promise, the hook finishes executing before the next hook starts.

```javascript
var CrispHooks = require('crisphooks');
var hooks = new CrispHooks();

hooks.hook('sleep', function(amount) {
	console.log('Sleeping for ' + amount);
});

hooks.hook('sleep', function(amount) {
	return new Promise(function(resolve) {
		setTimeout(function() {
			resolve();
		}, amount);
	});
});

hooks.hook('sleep', function() {
	console.log('zzzz...');
});

hooks.trigger('sleep', 5000).then(function() {
	console.log('Done sleeping.');
});
```

Output:
```
Sleeping for 5000
zzzz...
Done sleeping.
```

## With callbacks instead of Promises

The same thing can be done in a callback-style instead of a Promise-style.

```js
var CrispHooks = require('crisphooks');
var hooks = new CrispHooks();

hooks.hookSync('sleep', function(amount) {
	console.log('Sleeping for ' + amount);
});

hooks.hookAsync('sleep', function(amount, next) {
	setTimeout(function() {
		next();
	}, amount);
});

hooks.hookSync('sleep', function() {
	console.log('zzzz...');
});

hooks.triggerAsync('sleep', 5000, function(error) {
	console.log('Done sleeping.');
});
```

## Can execute synchronously with no async hooks

If there are no asynchronous hooks, hooks can be executed synchronously.  If .triggerSync()
is used when there are registered asynchronous hooks, all asynchronous hooks are executed
in parallel and errors from them result in a global exception being thrown.

```javascript
hooks.hookSync('doSomething', function() {
	console.log('Something.');
});

hooks.triggerSync('doSomething');
```

## Hook Priorities for Execution Order

Priorities can be specified as a second argument to `.hook()`, `.hookSync()` or `.hookAsync()` .  Lower priorities execute first.
If no priority is specified, it defaults to 0.  If multiple hooks are registered with the same priority, they are
executed in the order they are registered.

```javascript
hooks.hook('doSomething', 5, function() {
	console.log('Do something second');
});

hooks.hook('doSomething', 2, function() {
	console.log('Do something first');
});
```

## Error Handling

When registering a hook, you can also register an error cleanup function with it.  This function should undo
any effects of the hook that need to be undone on error.  If an error occurs in the chain of hooks, the
error cleanup function of any previous hooks (not including the hook that generated the error) are called
in reverse order.

```javascript
hooks.hook('doSomething', function() {
	console.log('Doing something 1.');
}, function(error) {
	console.log('Handling error 1', error);
});

hooks.hookAsync('doSomething', function() {
	console.log('Doing something 2.');
	throw new Error('Some Error');
});

hooks.trigger('doSomething').catch(function(error) {
	console.log('Got error', error);
});
```

Output:
```
Doing something 1.
Doing something 2.
Handling error 1 Some Error
Got error Some Error
```

Errors can be generated inside async callback-based hooks by calling next() with an argument (the error).  Errors are generated in
sync hooks by throwing exceptions.  Hooks registered using `.hook()` may either throw an exception or return a promise that rejects.

Error handler hooks can be manually called using the triggerError() or triggerErrorSync() methods.  The error handlers are called in the reverse order
of hook priority.

## Setting the this pointer for hooks

You can set what 'this' points to for the hooks by adding it as the first argument of any of the trigger functions.

```javascript
hooks.trigger(myObject, 'doSomething', arg1, arg2...);
```

## Mongoose-style Hooks/Middleware

CrispHooks also supports mongoose-style pre/post hooks.

```javascript
var CrispPrePostHooks = require('crisphooks').CrispPrePostHooks;
var hooks = new CrispPrePostHooks();

// Pre hooks are asynchronous.  They are registered as async hooks with the name: pre-someEvent
hooks.pre('someEvent', function(next) {
	console.log('Pre someEvent');
	next();
});

// Post hooks are synchronous.  They are registered as sync hooks with the name: post-someEvent
hooks.post('someEvent', function() {
	console.log('Post someEvent');
});

hooks.triggerPre('someEvent').then(function() {
	console.log('Done with pre.');
	hooks.triggerPost('someEvent');
	console.log('Done with post.');
});
```

Output:
```
Pre someEvent
Done with pre.
Post someEvent
Done with post.
```

These can be combined and interspersed with normal hooks.  CrispPrePostHooks inherits from CrispHooks.
Registering a pre hook is equivalent to registering a hook with its name prefixed with `pre-`.  Similarly,
a post hook is just the hook name prepended by `post-`.

## EventEmitter-style Hooks

CrispHooks can also add method aliases to act somewhat like an EventEmitter.

```javascript
var CrispHooks = require('crisphooks');
var hooks = new CrispHooks({
	eventEmitter: true
});

// Alias for hookSync
hooks.on('someEvent', function(param) {
	console.log('Handling event with param: ' + param);
});

// Alias for triggerSync
hooks.emit('someEvent', 'Some Param');
```

## Adding Hooks to an Object

Hooks can be added to an object either with standard prototypal inheritance or using the addHooks() method.

```javascript
var CrispHooks = require('crisphooks');

// Standard prototypal inheritance
function MyObject() {
}
MyObject.prototype = new CrispHooks();
var myObject = new MyObject();

// Node.JS prototypal inheritance
function MyObject2() {
}
require('util').inherits(MyObject2, CrispHooks);
var myObject2 = new MyObject2();

// Add methods to existing object (also works with CrispPrePostHooks.addHooks())
var myObject3 = {};
CrispHooks.addHooks(myObject3);
```

