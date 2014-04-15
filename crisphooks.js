(function() {


/**
 * Main CrispHooks constructor.  This creates an object to which hooks can be added, and
 * on which hooks can be called.
 *
 * @param options object Options changing the behavior of the hooks object
 * Can include:
 * - eventEmitter: Add EventEmitter-style aliases to hooks
 */
function CrispHooks(options) {
	if(options && options.eventEmitter) {
		this.on = CrispHooks.prototype.hookSync;
		this.emit = CrispHooks.prototype.triggerSync;
	}
	this._hooks = {};
}

/**
 * Add a synchronous hook.
 *
 * @param name string The name of the event to add a hook to
 * @param priority number Optional.  Numeric priority for the order of the hook execution.  Lower priorities are executed first.
 * @param handler function(arg1, ...) Handler for the synchronous hook.  Should throw on error.
 * @param errorHandler function(error) Optional. Handler in case of error.  Is only called if an error occurs after handler is called, and should
 * clean up if necessary.  They are called in reverse order of handler.
 * @return object this
 */
CrispHooks.prototype.hookSync = function() {
	return this._addHook(false, toArray(arguments));
};

/**
 * Add an asynchronous hook.
 *
 * @param name string The name of the event to add a hook to
 * @param priority number Optional.  Numeric priority for the order of the hook execution.  Lower priorities are executed first.
 * @param handler function(next, arg1, ...) Handler for the synchronous hook.  Call next() when finished, with an optional error argument.
 * @param errorHandler function(error, next) Optional. Handler in case of error.  Is only called if an error occurs after handler is called, and should
 * clean up if necessary.  They are called in reverse order of handler.
 * @return object this
 */
CrispHooks.prototype.hookAsync = function() {
	return this._addHook(true, toArray(arguments));
};

CrispHooks.prototype._addHook = function(isAsync, args) {
	var name = args.shift();
	var priority = (typeof args[0] == 'number') ? args.shift() : 0;
	var handler = args.shift();
	var errorHandler = args.shift();

	var nameHooks;
	if(this._hooks[name]) {
		nameHooks = this._hooks[name];
	} else {
		nameHooks = this._hooks[name] = {
			hooks: [],
			sorted: true,
			hookCtr: 0
		};
	}

	nameHooks.hooks.push({
		priority: priority,
		hookNumber: nameHooks.hookCtr++,
		async: isAsync,
		handler: handler,
		errorHandler: errorHandler
	});
	if(nameHooks.hooks.length > 1) {
		nameHooks.sorted = false;
	}

	return this;
};

/**
 * Alias of hookSync
 */
CrispHooks.prototype.hook = CrispHooks.prototype.hookSync;

CrispHooks.prototype._sortHooks = function(name) {
	var nameHooks = this._hooks[name];
	if(!nameHooks || !nameHooks.hooks || !nameHooks.hooks.length || nameHooks.sorted) return;
	nameHooks.hooks.sort(function(a, b) {
		if(a.priority > b.priority) return 1;
		if(b.priority > a.priority) return -1;
		return a.hookCtr - b.hookCtr;
	});
	nameHooks.sorted = true;
};

/**
 * Triggers an event, and calls the corresponding series of hooks.
 *
 * @param thisPtr mixed Optional.  If supplied, this is used as the this pointer for calling hooks.
 * @param name string The name of the event to trigger.
 * @param arg1...argN mixed Optional arguments to supply to the hooks.
 * @param cb function(error) Callback to call when hooks have completed.
 */
CrispHooks.prototype.trigger = function() {
	var args = toArray(arguments);
	var thisPtr = (typeof args[0] == 'string') ? this : args.shift();
	var name = args.shift();
	var cb = args[args.length - 1];
	args = args.slice(0, -1);

	var nameHooks = this._hooks[name];
	if(!nameHooks) return cb();

	this._sortHooks(name);
	var hookArray = nameHooks.hooks;

	var curHookNum = 0;
	function runNextHook(error) {
		if(error) {
			curHookNum -= 2;
			return runNextErrorHook(error);
		}
		if(curHookNum >= hookArray.length) return cb();
		var hook = hookArray[curHookNum];
		curHookNum++;
		try {
			if(hook.async) {
				hook.handler.apply(thisPtr, [runNextHook].concat(args));
			} else {
				hook.handler.apply(thisPtr, args);
				runNextHook();
			}
		} catch (ex) {
			runNextHook(ex);
		}
	}

	function runNextErrorHook(error) {
		if(curHookNum < 0) return cb(error);
		var hook = hookArray[curHookNum];
		curHookNum--;
		if(!hook.errorHandler) return runNextErrorHook(error);
		if(hook.async) {
			hook.errorHandler.apply(thisPtr, [function() {
				runNextErrorHook(error);
			}, error].concat(args));
		} else {
			hook.errHandler.apply(thisPtr, [error].concat(args));
			runNextErrorHook(error);
		}
	}

	runNextHook();
	return this;
};

/**
 * Triggers the error handlers for an event.
 *
 * @param thisPtr mixed Optional.  If supplied, this is used as the this pointer for calling hooks.
 * @param name string The name of the event to trigger.
 * @param error mixed The error to pass to the error handlers.
 * @param cb function(error) Callback to call when hooks have completed.
 */
CrispHooks.prototype.triggerError = function() {
	var args = toArray(arguments);
	var thisPtr = (typeof args[0] == 'string') ? this : args.shift();
	var name = args.shift();
	var cb = args[args.length - 1];
	args = args.slice(0, -1);

	var nameHooks = this._hooks[name];
	if(!nameHooks) return cb();

	this._sortHooks(name);
	var hookArray = nameHooks.hooks;

	var curHookNum = hookArray.length - 1;
	function runNextHook() {
		if(curHookNum < 0) return cb();
		var hook = hookArray[curHookNum];
		curHookNum--;
		if(!hook.errorHandler) return runNextHook();
		if(hook.async) {
			hook.errorHandler.apply(thisPtr, [runNextHook].concat(args));
		} else {
			hook.errorHandler.apply(thisPtr, args);
			runNextHook();
		}
	}

	runNextHook();
	return this;
};

/**
 * Triggers an event synchronously.  This throws if any asynchronous hooks are registered, and also throws if any hook throws.
 *
 * @param thisPtr mixed Optional.  If supplied, this is used as the this pointer for calling hooks.
 * @param name string The name of the event to trigger.
 * @param arg1...argN mixed Optional arguments to supply to the hooks.
 */
CrispHooks.prototype.triggerSync = function() {
	var name = (typeof arguments[0] == 'string') ? arguments[0] : arguments[1];
	if(this._hooks[name]) {
		for(var i = 0; i < this._hooks[name].hooks.length; i++) {
			if(this._hooks[name].hooks[i].async) {
				throwError('Cannot use triggerSync when async hooks are registered');
			}
		}
	}
	this.trigger.apply(this, toArray(arguments).concat([function(error) {
		if(error) throwError(error);
	}]));
	return this;
};

/**
 * Triggers an event's error handlers synchronously.
 *
 * @param thisPtr mixed Optional.  If supplied, this is used as the this pointer for calling hooks.
 * @param name string The name of the event to trigger.
 * @param error mixed Error to supply to the error handlers
 */
CrispHooks.prototype.triggerErrorSync = function() {
	var name = (typeof arguments[0] == 'string') ? arguments[0] : arguments[1];
	if(this._hooks[name]) {
		for(var i = 0; i < this._hooks[name].hooks.length; i++) {
			if(this._hooks[name].hooks[i].async) {
				throwError('Cannot use triggerSync when async hooks are registered');
			}
		}
	}
	this.triggerError.apply(this, toArray(arguments).concat([function() {}]));
	return this;
};

/**
 * Wraps a section of code in a block that is executed after hooks are executed.  This has the following additional properties:
 * - If any hooks exist with the name pre-NAME, these are executed before the hooks with the name NAME.
 * - If any hooks exist with the name post-NAME, these are executed when origCb is called (after the block of code finishes), if origCb is not called with an error.
 * - If origCb is called with an error, the error handlers of all hooks executed so far are called, in reverse order.
 *
 * @param thisPtr mixed Optional.  If supplied, this is used as the this pointer for calling hooks.
 * @param name string Name of event to trigger.
 * @param arg1..argN mixed Optional arguments to pass to the hooks
 * @param origCb function(...) Original callback.  This is called once the contained code and hooks finish executing.  It is called with the same arguments passed to cb .
 * @param func function(cb) Wrapped code to execute.  It should call cb with an error and optional result argument(s).
 */
CrispHooks.prototype.triggerWrap = function() {
	var self = this;
	var args = toArray(arguments);
	var thisPtr = (typeof args[0] == 'string') ? this : args.shift();
	var name = args.shift();
	var origCb = args[args.length - 2];
	var func = args[args.length - 1];
	args = args.slice(0, -2);

	var triggeredHooks = [];
	function runHooks(name, cb) {
		self.trigger.apply(self, [thisPtr, name].concat(args).concat([function(error) {
			if(error) return cb(error);
			triggeredHooks.push(name);
			cb();
		}]));
	}
	function cleanupOnError(error, cb) {
		function nextErrorHook() {
			if(!triggeredHooks.length) return cb(error);
			var name = triggeredHooks[triggeredHooks.length - 1];
			triggeredHooks = triggeredHooks.slice(0, -1);
			self.triggerError.apply(self, [thisPtr, name, error].concat(args).concat([nextErrorHook]));
		}
		nextErrorHook();
	}

	runHooks('pre-' + name, function(error) {
		if(error) return cleanupOnError(error, origCb);
		runHooks(name, function(error) {
			if(error) return cleanupOnError(error, origCb);
			func(function(error) {
				if(error) return cleanupOnError(error, origCb);
				var funcCbArgs = toArray(arguments);
				runHooks('post-' + name, function(error) {
					if(error) return cleanupOnError(error, origCb);
					origCb.apply(self, funcCbArgs);
				});
			});
		});
	});

	return this;
};



/**
 Inherits from CrispHooks, and adds additional functions to emulate the mongoose-style pre/post hooks.
 */
function CrispPrePostHooks(options) {
	CrispHooks.call(this, options);
}

CrispPrePostHooks.prototype = new CrispHooks();

/**
 * Registers a pre- hook.  This is the same as .hookAsync, but the name is prepended with "pre-".
 */
CrispPrePostHooks.prototype.pre = function() {
	var args = toArray(arguments);
	args[0] = 'pre-' + args[0];
	return this.hookAsync.apply(this, args);
};

/**
 * Registers a post- hook.  This is the same as .hookSync, but the name is prepended with "post-".
 */
CrispPrePostHooks.prototype.post = function() {
	var args = toArray(arguments);
	args[0] = 'post-' + args[0];
	return this.hookSync.apply(this, args);
};

/**
 * This is the same as .trigger, but the name is prepended with "pre-".
 */
CrispPrePostHooks.prototype.triggerPre = function() {
	var args = toArray(arguments);
	var idx = (typeof args[0] == 'string') ? 0 : 1;
	args[idx] = 'pre-' + args[idx];
	return this.trigger.apply(this, args);
};

/**
 * This is the same as .triggerSync, but the name is prepended with "post-".
 */
CrispPrePostHooks.prototype.triggerPost = function() {
	var args = toArray(arguments);
	var idx = (typeof args[0] == 'string') ? 0 : 1;
	args[idx] = 'post-' + args[idx];
	return this.triggerSync.apply(this, args);
};



function toArray(args) {
	return Array.prototype.slice.call(args, 0);
}

function throwError(message) {
	if(typeof Error == 'function') {
		throw new Error(message);
	} else {
		throw message;
	}
}


CrispHooks.addHooks = function(obj, options) {
	CrispHooks.call(obj, options);
	var key;
	for(key in CrispHooks.prototype) {
		obj[key] = CrispHooks.prototype[key];
	}
	return obj;
};

CrispPrePostHooks.addHooks = function(obj, options) {
	CrispPrePostHooks.call(obj, options);
	var key;
	for(key in CrispHooks.prototype) {
		obj[key] = CrispHooks.prototype[key];
	}
	for(key in CrispPrePostHooks.prototype) {
		obj[key] = CrispPrePostHooks.prototype[key];
	}
	return obj;
};

if(typeof module != 'undefined') {
	module.exports = CrispHooks;
	module.exports.CrispPrePostHooks = CrispPrePostHooks;
} else if(typeof window != 'undefined') {
	window.CrispHooks = CrispHooks;
	window.CrispPrePostHooks = CrispPrePostHooks;
} else {
	throwError("Did not find node or browser.");
}

})();
