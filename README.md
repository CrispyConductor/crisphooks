crisphooks
==========

Simple and powerful asynchronous/synchronous hooks for Node.JS and browsers.

## Installing

```
npm install crisphooks
```

## Asynchronous or Synchronous Hooks

Hooks registered using the `hook()` method can either return scalar values or Promises.
If it returns a Promise, the hook finishes executing before the next hook starts.

```javascript
import { CrispHooks } from 'crisphooks';
const hooks = new CrispHooks();

hooks.hook('sleep', function(amount) {
	console.log('Sleeping for ' + amount);
});

hooks.hook('sleep', async function(amount) {
	await new Promise((resolve) => setTimeout(resolve, amount));
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

## Can execute synchronously with no async hooks

If there are no asynchronous hooks, hooks can be executed synchronously.  If .triggerSync()
is used when there are registered asynchronous hooks, all asynchronous hooks are executed
in parallel and errors from them result in a global exception being thrown.

```javascript
hooks.hook('doSomething', function() {
	console.log('Something.');
});

hooks.triggerSync('doSomething');
```

## Hook Priorities for Execution Order

Priorities can be specified as a fourth argument to `.hook()`  Lower priorities execute first.
If no priority is specified, it defaults to 0.  If multiple hooks are registered with the same priority, they are
executed in the order they are registered.

```javascript
hooks.hook('doSomething', function() {
	console.log('Do something second');
}, null, 5);

hooks.hook('doSomething', function() {
	console.log('Do something first');
}, null, 2);
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

hooks.hook('doSomething', function() {
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

Error handler hooks can be manually called using the triggerError() or triggerErrorSync() methods.  The error handlers are called in the reverse order
of hook priority.

## Mongoose-style Hooks/Middleware

CrispHooks also supports mongoose-style pre/post hooks.

```javascript
import { CrispPrePostHooks } from 'crisphooks';
const hooks = new CrispPrePostHooks();

// Pre hooks are asynchronous.  They are registered as async hooks with the name: pre-someEvent
hooks.pre('someEvent', function() {
	console.log('Pre someEvent');
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

## Mixins

A few mixins are provided to add hooks to existing classes.

```javascript
import { CrispHooksMixin, CrispPrePostHooksMixin } from 'crisphooks';
const MyClassWithHooks = CrispHooksMixin(MyClass);
const MyClassWithPPHooks = CrispPrePostHooksMixin(MyClass);
```

A mixin is also provided to add EventEmitter-style methods on top of a CrispHooks class:

```javascript
import { EventEmitterMixin } from 'crisphooks';
const MyEventEmitterHooksClass = EventEmitterMixin(MyCrispHooksClass);
```


