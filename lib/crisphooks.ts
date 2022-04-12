type Constructor = new (...args: any[]) => {};

export type HookType = {
	priority: number;
	hookNumber: number;
	handler: (...args: any[]) => any;
	errorHandler?: (error: any, ...args: any[]) => any;
};

export type HookContainerType = {
	hooks: HookType[];
	sorted: boolean;
	hookCtr: number;
};

/**
 * Mixin to add CrispHooks into a class.
 */
export function CrispHooksMixin<TBase extends Constructor>(Base: TBase) {
	return class CrispHooksBase extends Base {
		_hooks: { [hookName: string]: HookContainerType };

		constructor(...args: any[]) {
			super(...args);
			this._hooks = {};
		}

		_addHook(opts: { name: string, priority?: number, handler: (...args: any) => any, errorHandler: (error: any, ...args: any[]) => any }): CrispHooksBase {
			let nameHooks: HookContainerType;
			if(this._hooks[opts.name]) {
				nameHooks = this._hooks[opts.name];
			} else {
				nameHooks = this._hooks[opts.name] = {
					hooks: [],
					sorted: true,
					hookCtr: 0
				};
			}
			nameHooks.hooks.push({
				priority: opts.priority || 0,
				hookNumber: nameHooks.hookCtr++,
				handler: opts.handler,
				errorHandler: opts.errorHandler
			});
			if(nameHooks.hooks.length > 1) {
				nameHooks.sorted = false;
			}
			return this;
		}
		/**
		 * Add a hook that may either be synchronous or asynchronous.  Both the handler and the error handler
		 * may optionally return a promise, indicating that the result will be available asynchronously.  If
		 * they return a non-promise or throw an exception, it is treated as a synchronous hook.
		 *
		 * @param {String} name - The name of the event to add a hook to
		 * @param {Function} handler - Handler for the synchronous hook.  Should throw on error.
		 *   @param {Mixed} [handler.arg1...] - Arguments passed to trigger.
		 * @param {Function} [errorHandler] - Handler in case of error.  Is only called if an error occurs after handler is called, and should
		 *   clean up if necessary.  They are called in reverse order of handler.
		 *   @param {Mixed} errorHandler.error - Error supplied to the error handler
		 * @param {Number} [priority=0] - Numeric priority for the order of the hook execution.  Lower priorities are executed first.
		 * @return {CrispHooks} - this
		 */
		hook(name: string, handler: (...args: any[]) => any, errorHandler: (error: any, ...args: any[]) => any = null, priority: number = 0): CrispHooksBase {
			return this._addHook({
				name,
				priority,
				handler,
				errorHandler
			});
		}

		/**
		 * Sorts hooks by priority.
		 */
		_sortHooks(name: string): void {
			let nameHooks: HookContainerType = this._hooks[name];
			if(!nameHooks || !nameHooks.hooks || nameHooks.hooks.length <= 1 || nameHooks.sorted) return;
			nameHooks.hooks.sort((a: HookType, b: HookType) => {
				if(a.priority > b.priority) return 1;
				if(b.priority > a.priority) return -1;
				return a.hookNumber - b.hookNumber;
			});
			nameHooks.sorted = true;
		}

		_trigger(opts: { name: string, args: any[], triggerWithError?: any }): Promise<any> {
			let nameHooks: HookContainerType = this._hooks[opts.name];
			if (!nameHooks) return Promise.resolve([]);
			this._sortHooks(opts.name);
			// Duplicate hook array to prevent weird behavior if hooks are modified
			// while being run.
			let hookArray: HookType[] = nameHooks.hooks.slice(0);

			return new Promise(function(resolve, reject) {

				let curHookNum: number = 0;
				let curHookResults: any[] = [];

				if(opts.triggerWithError) {
					curHookNum = hookArray.length - 1;
					runNextErrorHook(opts.triggerWithError);
				} else {
					runNextHook();
				}

				function runNextHook(error = null) {
					if(error) {
						curHookNum -= 2;
						return runNextErrorHook(error);
					}
					if (curHookNum >= hookArray.length) {
						return resolve(curHookResults);
					}
					let hook: HookType = hookArray[curHookNum];
					curHookNum++;

					try {
						let hookReturn: any = hook.handler(...(opts.args));
						if(isPromise(hookReturn)) {
							hookReturn.then(function(result: any) {
								curHookResults.push(result);
								runNextHook();
							}, function(error: any) {
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

				function runNextErrorHook(error: any) {
					if(curHookNum < 0) {
						if(opts.triggerWithError) {
							return resolve(undefined);
						} else {
							return reject(error);
						}
					}
					let hook: HookType = hookArray[curHookNum];
					curHookNum--;
					if(!hook.errorHandler) return runNextErrorHook(error);

					try {
						let hookReturn: any = hook.errorHandler(error, ...(opts.args));
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
		 * @param {String} name - The name of the event to trigger.
		 * @param {Mixed} arg1...argN - Optional arguments to supply to the hooks.
		 * @return {Promise} - Promise that resolves when all hooks are complete.
		 */
		async trigger(name: string, ...args: any[]): Promise<any[] | undefined> {
			return await this._trigger({
				name,
				args
			});
		}

		/**
		 * Triggers the error handlers for an event.
		 *
		 * @param {String} name - The name of the event to trigger.
		 * @param {Mixed} error - Error to pass to hooks.
		 * @return {Promise} - Promise that resolves when all hooks are complete.
		 */
		async triggerError(name: string, error: any): Promise<any[] | undefined> {
			return await this._trigger({
				name,
				args: [],
				triggerWithError: error
			});
		}

		_triggerSync(opts: { name: string, args: any[], triggerWithError?: any }): any[] | undefined {
			let nameHooks: HookContainerType = this._hooks[opts.name];
			if (!nameHooks) return [];
			this._sortHooks(opts.name);
			// Duplicate hook array to prevent weird behavior if hooks are modified
			// while being run.
			let hookArray: HookType[] = nameHooks.hooks.slice(0);

			let curHookNum: number = 0;
			var curHookResults: any[] = [];

			if(opts.triggerWithError) {
				curHookNum = hookArray.length - 1;
				runNextErrorHook(opts.triggerWithError);
				return undefined;
			} else {
				runNextHook(null);
				return curHookResults;
			}

			function runNextHook(error: any) {
				if(error) {
					curHookNum -= 2;
					return runNextErrorHook(error);
				}
				if(curHookNum >= hookArray.length) return;
				var hook = hookArray[curHookNum];
				curHookNum++;

				try {
					let hookReturn = hook.handler(...(opts.args));
					if(isPromise(hookReturn)) {
						hookReturn.catch(catchPromiseError);
					} else {
						curHookResults.push(hookReturn);
					}
					runNextHook(null);
				} catch (ex) {
					runNextHook(ex);
				}
			}

			function runNextErrorHook(error: any) {
				if(curHookNum < 0) {
					if(opts.triggerWithError) {
						return undefined;
					} else {
						throw error;
					}
				}
				let hook: HookType = hookArray[curHookNum];
				curHookNum--;
				if(!hook.errorHandler) return runNextErrorHook(error);

				try {
					let hookReturn: any = hook.errorHandler(error, ...(opts.args));
					if (isPromise(hookReturn)) {
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
		 * Run hooks synchronously.
		 */
		triggerSync(name: string, ...args: any[]): any[] | undefined {
			return this._triggerSync({
				name,
				args
			});
		}

		/**
		 * Run error hooks synchronously.
		 */
		triggerErrorSync(name: string, error: any): any[] | undefined {
			return this._triggerSync({
				name,
				args: [],
				triggerWithError: error
			});
		}

		/**
		 * This triggers hooks for pre-NAME, then triggers hooks for NAME, then executes the given function, then
		 * triggers hooks for post-NAME .  If anything in the sequence fails, all relevant previous error handlers
		 * are called.
		 *
		 * @param {String} name - Name of hooks to execute.
		 * @param {Function} fn - Promise-returning function to execute between the pre and post hooks.
		 * @param {Mixed} [arg1..argN] - Arguments to supply to the hooks.
		 * @return {Promise} - Returns the return value of fn
		 */
		triggerWrap<T>(name: string, fn: () => T, ...args: any[]): Promise<T> {
			let ranPreHooks: boolean = false;
			let ranNeutralHooks: boolean = false;

			const runHooks = (name: string): Promise<any[] | undefined> => {
				return this.trigger(name, ...args);
			};

			const cleanupOnError = (error: any): Promise<any> => {
				if(ranNeutralHooks) {
					return this.triggerError(name, error).then(() => {
						return this.triggerError('pre-' + name, error);
					}).then(() => {
						return Promise.reject(error);
					});
				} else if(ranPreHooks) {
					this.triggerError('pre-' + name, error).then(() => {
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
				return fn();
			}).then(function() {
				return runHooks('post-' + name);
			}).catch(function(error) {
				return cleanupOnError(error);
			});
		};


	};

};


export function CrispPrePostHooksMixin<TBase extends Constructor>(Base: TBase) {
	const HClass = CrispHooksMixin(Base);
	return class CrispPrePostHooksBase extends HClass {


		pre(name: string, handler: (...args: any[]) => any, errorHandler: (error: any) => any = null, priority: number = 0): CrispPrePostHooksBase {
			this.hook('pre-' + name, handler, errorHandler, priority);
			return this;
		}

		post(name: string, handler: (...args: any[]) => any, errorHandler: (error: any) => any = null, priority: number = 0): CrispPrePostHooksBase {
			this.hook('post-' + name, handler, errorHandler, priority);
			return this;
		}

		async triggerPre(name: string, ...args: any[]): Promise<any[] | undefined> {
			return await this.trigger('pre-' + name, ...args);
		}

		async triggerPost(name: string, ...args: any[]): Promise<any[] | undefined> {
			return await this.trigger('post-' + name, ...args);
		}

	};
};



type GConstructor<T = {}> = new (...args: any[]) => T;

export function EventEmitterMixin<TBase extends GConstructor<{ hook(name: string, handler, errorHandler?: any, priority?: any); triggerSync(name: string, ...args: any[]); }>>(Base: TBase) {
	return class EventEmitterHooksBase extends Base {

			on(name: string, fn: (arg?: any) => void): EventEmitterHooksBase {
				this.hook(name, (arg: any) => {
					fn(arg);
				});
				return this;
			}

			emit(name: string, arg?: any): void {
				this.triggerSync(name, arg);
			}

	}

};




function isPromise(val: any): boolean {
	return !!(val && typeof val.then === 'function');
}

function catchPromiseError(error: any) {
	// Throws an error outside of the context of a promise
	setImmediate(function() {
		throw error;
	});
}


export const CrispHooks = CrispHooksMixin(Object);
export const CrispPrePostHooks = CrispPrePostHooksMixin(Object);





