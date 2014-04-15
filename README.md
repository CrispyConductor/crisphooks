crisphooks
==========

Simple asynchronous/synchronous hooks for Node.JS and browsers.

## Installing

```
npm install crisphooks
```

## Asynchronous or Synchronous Hooks

```javascript
var CrispHooks = require('crisphooks');
var hooks = new CrispHooks();

hooks.hookSync('sleep', function(amount) {
	console.log('Sleeping for ' + amount);
});

hooks.hookAsync('sleep', function(next, amount) {
	setTimeout(function() {
		console.log('zzzz...');
		next();
	}, amount);
});

hooks.trigger('sleep', 5000, function(error) {
	if(error) console.log('Got error sleeping!');
	else console.log('Done sleeping.');
});
```

Output:
```
Sleeping for 5000
zzzz...
Done sleeping.
```

## Can execute synchronously with no async hooks

If there are no asynchronous hooks, hooks can be executed synchronously.  Using .triggerSync()
when there are asynchonous hooks registered will result in an exception being thrown.

```javascript
hooks.hookSync('doSomething', function() {
	console.log('Something.');
});

hooks.triggerSync('doSomething');
```

## Hook Priorities for Execution Order

Priorities can be specified as a second argument to .hookSync() or .hookAsync() .  Lower priorities execute first.
If no priority is specified, it defaults to 0.  If multiple hooks are registered with the same priority, they are
executed in the order they are registered.

```javascript
hooks.hookSync('doSomething', 5, function() {
	console.log('Do something second');
});

hooks.hookSync('doSomething', 2, function() {
	console.log('Do something first');
});
```

## Error Handling

When registering a hook, you can also register an error cleanup function with it.  This function should undo
any effects of the hook that need to be undone on error.  If an error occurs in the chain of hooks, the
error cleanup function of any previous hooks (not including the hook that generated the error) are called
in reverse order.

```javascript
hooks.hookAsync('doSomething', function(next) {
	console.log('Doing something 1.');
	next();
}, function(next, error) {
	console.log('Handling error 1', error);
	next();
});

hooks.hookAsync('doSomething', function(next) {
	console.log('Doing something 2.');
	next('Some Error');
});

hooks.trigger('doSomething', function(error) {
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

Errors can be generated inside async hooks by calling next() with an argument (the error).  Errors are generated in
sync hooks by throwing exceptions.  If using trigger(), errors are returned as the first argument of the callback.
If using triggerSync(), errors are returned by throwing it as an exception.

Error handler hooks can be manually called using the triggerError() or triggerErrorSync() methods.  The error handlers are called in the reverse order
of hook priority.

Asynchronous hooks have asynchronous error handlers in the form function(next, error).  Synchronous hooks have
synchronous error handlers in the form function(error).

```javascript
hooks.triggerError('doSomething', error, function() {
});
hooks.triggerErrorSync('doSomething', error);
```

## Setting the this pointer for hooks

You can set what 'this' points to for the hooks by adding it as the first argument of any of the trigger functions.

```javascript
hooks.trigger(myObject, 'doSomething', arg1, function(error) {
});
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

hooks.triggerPre('someEvent', function(error) {
	console.log('Done with pre.');
});

hooks.triggerPost('someEvent');
console.log('Done with post.');
```

Output:
```
Pre someEvent
Done with pre.
Post someEvent
Done with post.
```

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
