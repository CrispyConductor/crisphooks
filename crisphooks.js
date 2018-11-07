var Promise = require('es6-promise').Promise;

/**
 * Main CrispHooks constructor.  This creates an object to which hooks can be added, and
 * on which hooks can be called.
 *
 * @class CrispHooks
 * @constructor
 * @param {Object} options - Options changing the behavior of the hooks object
 * @param {Boolean} options.eventEmitter - Add EventEmitter-style aliases
 */
function CrispHooks(options) {
	if (options && options.eventEmitter) {
		this.on = CrispHooks.prototype.hookSync;
		this.emit = CrispHooks.prototype.triggerSync;
	}
	this._hooks = {};
}

CrispHooks.prototype._addHook = function(args) {
	var name = args.shift();
	var priority = (typeof args[0] === 'number') ? args.shift() : 0;
	var handler = args.shift();
	var errorHandler = args.shift();

	if(args.length !== 0) throwError('Too many arguments to addHook()');

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
		handler: handler,
		errorHandler: errorHandler
	});
	if(nameHooks.hooks.length > 1) {
		nameHooks.sorted = false;
	}

	return this;
};

/**
 * Add a synchronous hook.
 *
 * @param {String} name - The name of the event to add a hook to
 * @param {Number} [priority] - Numeric priority for the order of the hook execution.  Lower priorities are executed first.
 * @param {Function} handler - Handler for the synchronous hook.  Should throw on error.
 * @param {Mixed} [handler.arg1...] - Arguments passed to trigger.
 * @param {Function} [errorHandler] - Handler in case of error.  Is only called if an error occurs after handler is called, and should
 * clean up if necessary.  They are called in reverse order of handler.
 * @param {Mixed} errorHandler.error - Error supplied to the error handler
 * @return {CrispHooks} - this
 */
CrispHooks.prototype.hookSync = function() {
	return this._addHook(toArray(arguments));
};

/**
 * Add an asynchronous hook utilizing a callback instead a promise to indicate asynchronous
 * behavior.
 *
 * @param {String} name - The name of the event to add a hook to
 * @param {Number} [priority] - Numeric priority for the order of the hook execution.  Lower priorities are executed first.
 * @param {Function} handler - Handler for the synchronous hook.  Should throw on error.
 * @param {Function} handler.next - Callback given to handler
 * @param {Mixed} [handler.arg1...] - Arguments passed to trigger.
 * @param {Function} [errorHandler] - Handler in case of error.  Is only called if an error occurs after handler is called, and should
 * clean up if necessary.  They are called in reverse order of handler.
 * @param {Function} errorHandler.next - Callback given to error handler
 * @param {Mixed} errorHandler.error - Error supplied to the error handler
 * @return {CrispHooks} - this
 */
CrispHooks.prototype.hookAsync = function() {
	var args = toArray(arguments);
	var name = args.shift();
	var priority = (typeof args[0] === 'number') ? args.shift() : 0;
	var handler = args.shift();
	var errorHandler = args.shift();
	this._addHook([
		name,
		priority,
		handler && function() {
			var self = this;
			var args = toArray(arguments);
			return new Promise(function(resolve, reject) {
				handler.apply(self, [function(error, result) {
					if(error) reject(error);
					else resolve(result);
				}].concat(args));
			});
		},
		errorHandler && function() {
			var self = this;
			var args = toArray(arguments);
			return new Promise(function(resolve, reject) {
				errorHandler.apply(self, [function(error) {
					if(error) reject(error);
					else resolve();
				}].concat(args));
			});
		}
	]);
};

/**
 * Add a hook that may either be synchronous or asynchronous.  Both the handler and the error handler
 * may optionally return a promise, indicating that the result will be available asynchronously.  If
 * they return a non-promise or throw an exception, it is treated as a synchronous hook.
 *
 * @param {String} name - The name of the event to add a hook to
 * @param {Number} [priority] - Numeric priority for the order of the hook execution.  Lower priorities are executed first.
 * @param {Function} handler - Handler for the synchronous hook.  Should throw on error.
 * @param {Mixed} [handler.arg1...] - Arguments passed to trigger.
 * @param {Function} [errorHandler] - Handler in case of error.  Is only called if an error occurs after handler is called, and should
 * clean up if necessary.  They are called in reverse order of handler.
 * @param {Mixed} errorHandler.error - Error supplied to the error handler
 * @return {CrispHooks} - this
 */
CrispHooks.prototype.hook = function() {
	return this._addHook(toArray(arguments));
};

CrispHooks.prototype._sortHooks = function(name) {
	var nameHooks = this._hooks[name];
	if(!nameHooks || !nameHooks.hooks || nameHooks.hooks.length <= 1 || nameHooks.sorted) return;
	nameHooks.hooks.sort(function(a, b) {
		if(a.priority > b.priority) return 1;
		if(b.priority > a.priority) return -1;
		return a.hookNumber - b.hookNumber;
	});
	nameHooks.sorted = true;
};

CrispHooks.prototype._trigger = function(args, triggerWithError) {
	var thisPtr = (typeof args[0] == 'string') ? this : args.shift();
	var name = args.shift();

	var nameHooks = this._hooks[name];
	if(!nameHooks) return Promise.resolve([]);

	this._sortHooks(name);
	// Duplicate hook array to prevent weird behavior if hooks are modified
	// while being run.
	var hookArray = nameHooks.hooks.slice(0);

	return new Promise(function(resolve, reject) {

		var curHookNum = 0;
		var curHookResults = [];

		if(triggerWithError) {
			curHookNum = hookArray.length - 1;
			runNextErrorHook(triggerWithError);
		} else {
			runNextHook();
		}

		function runNextHook(error) {
			if(error) {
				curHookNum -= 2;
				return runNextErrorHook(error);
			}
			if(curHookNum >= hookArray.length) return resolve(curHookResults);
			var hook = hookArray[curHookNum];
			curHookNum++;

			try {
				var hookReturn = hook.handler.apply(thisPtr, args);
				if(isPromise(hookReturn)) {
					hookReturn.then(function(result) {
						curHookResults.push(result);
						runNextHook();
					}, function(error) {
						runNextHook(error || new Error('Error running hook'));
					}).catch(catchPromiseError);
				} else {
					curHookResults.push(hookReturn);
					runNextHook();
				}
			} catch (ex) {
				runNextHook(ex);
			}
		}

		function runNextErrorHook(error) {
			if(curHookNum < 0) {
				if(triggerWithError) {
					return resolve();
				} else {
					return reject(error);
				}
			}
			var hook = hookArray[curHookNum];
			curHookNum--;
			if(!hook.errorHandler) return runNextErrorHook(error);

			try {
				var hookReturn = hook.errorHandler.apply(thisPtr, [error].concat(args));
				if(isPromise(hookReturn)) {
					hookReturn.then(function() {
						runNextErrorHook(error);
					}).catch(catchPromiseError);
				} else {
					runNextErrorHook(error);
				}
			} catch (ex) {
				// Thrown error while running error handler
				return catchPromiseError(ex);
			}
		}

	});

};

/**
 * Triggers an event, and calls the corresponding series of hooks.  Returns a promise.
 *
 * @param {Mixed} [thisPtr] - If supplied, this is used as the this pointer for calling hooks.
 * @param {String} name - The name of the event to trigger.
 * @param {Mixed} arg1...argN - Optional arguments to supply to the hooks.
 * @return {Promise} - Promise that resolves when all hooks are complete.
 */
CrispHooks.prototype.trigger = function() {
	return this._trigger(toArray(arguments));
};

/**
 * Triggers error handlers for an event.  Returns a promise.
 *
 * @param {Mixed} [thisPtr] - If supplied, this is used as the this pointer for calling hooks.
 * @param {String} name - The name of the event to trigger.
 * @param {Mixed} [error] - Argument to supply as error to error handlers.
 * @return {Promise} - Promise that resolves when all hooks are complete.
 */
CrispHooks.prototype.triggerError = function() {
	var args = toArray(arguments);
	var thisPtr = (typeof args[0] == 'string') ? this : args.shift();
	var name = args.shift();
	var error = args.shift() || new Error();
	return this._trigger([thisPtr, name], error);
};

/**
 * Identical to trigger(), except instead of returning a promise,
 * this accepts a callback as its final argument.
 */
CrispHooks.prototype.triggerAsync = function() {
	var args = toArray(arguments);
	var callback = args.pop();
	this._trigger(args).then(function(result) {
		callback(null, result);
	}, function(error) {
		callback(error);
	}).catch(catchPromiseError);
};

/**
 * Identical to triggerError(), except instead of returning a promise,
 * this accepts a callback as its final argument.
 */
CrispHooks.prototype.triggerErrorAsync = function() {
	var args = toArray(arguments);
	var callback = args.pop();
	var thisPtr = (typeof args[0] == 'string') ? this : args.shift();
	var name = args.shift();
	var error = args.shift() || new Error();
	this._trigger([thisPtr, name], error).then(function() {
		callback();
	}, function(error) {
		callback(error);
	}).catch(catchPromiseError);
};

CrispHooks.prototype._triggerSync = function(args, triggerWithError) {
	var thisPtr = (typeof args[0] == 'string') ? this : args.shift();
	var name = args.shift();

	var nameHooks = this._hooks[name];
	if(!nameHooks) return [];

	this._sortHooks(name);
	// Duplicate hook array to prevent weird behavior if hooks are modified
	// while being run.
	var hookArray = nameHooks.hooks.slice(0);

	var curHookNum = 0;
	var curHookResults = [];

	if(triggerWithError) {
		curHookNum = hookArray.length - 1;
		runNextErrorHook(triggerWithError);
		return;
	} else {
		runNextHook();
		return curHookResults;
	}

	function runNextHook(error) {
		if(error) {
			curHookNum -= 2;
			return runNextErrorHook(error);
		}
		if(curHookNum >= hookArray.length) return;
		var hook = hookArray[curHookNum];
		curHookNum++;

		try {
			var hookReturn = hook.handler.apply(thisPtr, args);
			if(isPromise(hookReturn)) {
				hookReturn.catch(catchPromiseError);
			} else {
				curHookResults.push(hookReturn);
			}
			runNextHook();
		} catch (ex) {
			runNextHook(ex);
		}
	}

	function runNextErrorHook(error) {
		if(curHookNum < 0) {
			if(triggerWithError) {
				return;
			} else {
				throw error;
			}
		}
		var hook = hookArray[curHookNum];
		curHookNum--;
		if(!hook.errorHandler) return runNextErrorHook(error);

		try {
			var hookReturn = hook.errorHandler.apply(thisPtr, [error].concat(args));
			if(isPromise(hookReturn)) {
				hookReturn.catch(catchPromiseError);
			}
			runNextErrorHook(error);
		} catch (ex) {
			// Thrown error while running error handler
			throw ex;
		}
	}

};


/**
 * Triggers an event, and calls the corresponding series of hooks.  All events are called
 * synchronously.  If any hook returns a promise, all such promises are executed in
 * parallel.  If any of these asynchronous promises reject, a global exception is thrown.
 *
 * @param {Mixed} [thisPtr] - If supplied, this is used as the this pointer for calling hooks.
 * @param {String} name - The name of the event to trigger.
 * @param {Mixed} arg1...argN - Optional arguments to supply to the hooks.
 * @return {Array} - Array of results.
 * @throws {Mixed} - Throws if any of the hooks throw.
 */
CrispHooks.prototype.triggerSync = function() {
	return this._triggerSync(toArray(arguments));
};

/**
 * Triggers error handlers for an event.  All handlers are called synchronously.
 *
 * @param {Mixed} [thisPtr] - If supplied, this is used as the this pointer for calling hooks.
 * @param {String} name - The name of the event to trigger.
 * @param {Mixed} [error] - Argument to supply as error to error handlers.
 */
CrispHooks.prototype.triggerErrorSync = function() {
	var args = toArray(arguments);
	var thisPtr = (typeof args[0] == 'string') ? this : args.shift();
	var name = args.shift();
	var error = args.shift() || new Error();
	return this._triggerSync([thisPtr, name], error);
};

/**
 * This triggers hooks for pre-NAME, then triggers hooks for NAME, then executes the given function, then
 * triggers hooks for post-NAME .  If anything in the sequence fails, all relevant previous error handlers
 * are called.
 *
 * @param {Object} [thisPtr] - If supplied, is given as the this pointer to executed hooks.
 * @param {String} name - Name of hooks to execute.
 * @param {Function} fn - Promise-returning function to execute between the pre and post hooks.
 * @param {Mixed} [arg1..argN] - Arguments to supply to the hooks and the function.
 * @return {Promise}
 */
CrispHooks.prototype.triggerWrap = function() {
	var self = this;
	var args = toArray(arguments);
	var thisPtr = (typeof args[0] == 'string') ? this : args.shift();
	var name = args.shift();
	var fn = args.shift();

	var ranPreHooks = false;
	var ranNeutralHooks = false;

	function runHooks(name) {
		return self.trigger.apply(thisPtr, [self, name].concat(args));
	}

	function cleanupOnError(error) {
		if(ranNeutralHooks) {
			return self.triggerError(thisPtr, name, error).then(function() {
				return self.triggerError(self, 'pre-' + name, error);
			}).then(function() {
				return Promise.reject(error);
			});
		} else if(ranPreHooks) {
			self.triggerError(thisPtr, 'pre-' + name, error).then(function() {
				return Promise.reject(error);
			});
		} else {
			return Promise.reject(error);
		}
	}

	return runHooks('pre-' + name).then(function() {
		ranPreHooks = true;
		return runHooks(name);
	}).then(function() {
		ranNeutralHooks = true;
		return fn.apply(thisPtr, args);
	}).then(function() {
		return runHooks('post-' + name);
	}).catch(function(error) {
		return cleanupOnError(error);
	});
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
 * This is the same as .trigger, but the name is prepended with "post-".
 */
CrispPrePostHooks.prototype.triggerPost = function() {
	var args = toArray(arguments);
	var idx = (typeof args[0] == 'string') ? 0 : 1;
	args[idx] = 'post-' + args[idx];
	return this.trigger.apply(this, args);
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

function isPromise(val) {
	return val && typeof val.then === 'function';
}

function catchPromiseError(error) {
	// Throws an error outside of the context of a promise
	setImmediate(function() {
		throw error;
	});
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


module.exports = CrispHooks;
module.exports.CrispPrePostHooks = CrispPrePostHooks;

