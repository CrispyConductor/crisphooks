import { expect } from 'chai';
import { CrispHooks, CrispPrePostHooks, EventEmitterMixin } from '../lib/crisphooks.js';

function delayResult(result) {
	return new Promise(function(resolve) {
		setTimeout(function() {
			resolve(result);
		}, 3);
	});
}

function delayError(error) {
	return new Promise(function(resolve, reject) {
		setTimeout(function() {
			reject(error);
		}, 3);
	});
}

describe('CrispHooks', function() {

	it('should execute hooks as registered', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hook('foo', function(arg) {
			return delayResult('A' + arg);
		});
		crisphooks.hook('foo', function(arg) {
			return delayResult('B' + arg);
		});
		crisphooks.hook('foo', function(arg) {
			return delayResult('C' + arg);
		});
		crisphooks.trigger('foo', 1).then(function(result) {
			expect(result).to.deep.equal([ 'A1', 'B1', 'C1' ]);
			done();
		}).catch(done);
	});

	it('should execute hooks in priority order', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hook('foo', function(arg) {
			return delayResult('A' + arg);
		}, null, 2);
		crisphooks.hook('foo', function(arg) {
			return delayResult('B' + arg);
		}, null, 3);
		crisphooks.hook('foo', function(arg) {
			return delayResult('C' + arg);
		}, null, 1);
		crisphooks.trigger('foo', 1).then(function(result) {
			expect(result).to.deep.equal([ 'C1', 'A1', 'B1' ]);
			done();
		}).catch(done);
	});

	it('should execute a mix of synchronous and asynchronous hooks', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hook('foo', function(arg) {
			return 'A' + arg;
		});
		crisphooks.hook('foo', function(arg) {
			return delayResult('B' + arg);
		});
		crisphooks.hook('foo', function(arg) {
			return 'C' + arg;
		});
		crisphooks.trigger('foo', 1).then(function(result) {
			expect(result).to.deep.equal([ 'A1', 'B1', 'C1' ]);
			done();
		}).catch(done);
	});

	it('should handle asynchronous errors', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hook('foo', function(arg) {
			return 'A' + arg;
		});
		crisphooks.hook('foo', function(arg) {
			return delayError(123);
		});
		crisphooks.hook('foo', function(arg) {
			return 'C' + arg;
		});
		crisphooks.trigger('foo', 1).then(function(result) {
			done(new Error('should not reach'));
		}, function(error) {
			expect(error).to.equal(123);
			done();
		}).catch(done);
	});

	it('should handle synchronous errors', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hook('foo', function(arg) {
			return 'A' + arg;
		});
		crisphooks.hook('foo', function(arg) {
			throw 123;
		});
		crisphooks.hook('foo', function(arg) {
			return 'C' + arg;
		});
		crisphooks.trigger('foo', 1).then(function(result) {
			done(new Error('should not reach'));
		}, function(error) {
			expect(error).to.equal(123);
			done();
		}).catch(done);
	});

	it('should not have unexpected results when no hooks are registered', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.trigger('foo', 1).then(function(result) {
			expect(result).to.deep.equal([]);
			done();
		}).catch(done);
	});

	it('should not have unexpected results when a single hook is registered', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hook('foo', function(arg) {
			return delayResult('A' + arg);
		});
		crisphooks.trigger('foo', 1).then(function(result) {
			expect(result).to.deep.equal([ 'A1' ]);
			done();
		}).catch(done);
	});

	it('should execute error handler hooks in reverse order', function(done) {
		var crisphooks = new CrispHooks();
		var results = [];
		crisphooks.hook('foo', function(arg) {
			results.push('A');
			return delayResult('A' + arg);
		}, function(error: any, arg: any) {
			results.push('eA');
			expect(error).to.equal(123);
			expect(arg).to.equal(1);
		}, 1);
		crisphooks.hook('foo', function(arg) {
			results.push('B');
			return delayResult('B' + arg);
		}, function(error, arg) {
			results.push('eB');
			expect(error).to.equal(123);
			expect(arg).to.equal(1);
			return delayResult(undefined);
		}, 2);
		crisphooks.hook('foo', function(arg) {
			results.push('C');
			return delayError(123);
		}, function(error, arg) {
			results.push('eC');
			throw new Error('should not reach');
		}, 3);
		crisphooks.trigger('foo', 1).then(function() {
			done(new Error('should not reach'));
		}, function(error) {
			expect(error).to.equal(123);
			expect(results).to.deep.equal([ 'A', 'B', 'C', 'eB', 'eA' ]);
			done();
		}).catch(done);
	});

	it('should trigger all error handlers with triggerError', function(done) {
		var crisphooks = new CrispHooks();
		var results = [];
		crisphooks.hook('foo', function(arg) {}, function(error) {
			expect(error).to.equal(123);
			results.push('A');
		});
		crisphooks.hook('foo', function(arg) {}, function(error) {
			expect(error).to.equal(123);
			results.push('B');
			return delayResult(undefined);
		});
		crisphooks.hook('foo', function(arg) {}, function(error) {
			expect(error).to.equal(123);
			results.push('C');
		});
		crisphooks.triggerError('foo', 123).then(function(result) {
			expect(results).to.deep.equal([ 'C', 'B', 'A' ]);
			done();
		}).catch(done);
	});

	it('should trigger synchronous hooks in triggerSync', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hook('foo', function(arg) {
			return 'A' + arg;
		});
		crisphooks.hook('foo', function(arg) {
			return 'B' + arg;
		});
		crisphooks.hook('foo', function(arg) {
			return 'C' + arg;
		});
		var results = crisphooks.triggerSync('foo', 1);
		expect(results).to.deep.equal([ 'A1', 'B1', 'C1' ]);
		done();
	});

	it('should throw errors when called with triggerSync', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hook('foo', function(arg) {
			return 'A' + arg;
		});
		crisphooks.hook('foo', function(arg) {
			throw 123;
		});
		crisphooks.hook('foo', function(arg) {
			return 'C' + arg;
		});
		try {
			crisphooks.triggerSync('foo', 1);
		} catch (ex) {
			expect(ex).to.equal(123);
			return done();
		}
		done(new Error('should not reach'));
	});

	it('should work with triggerErrorSync', function(done) {
		var crisphooks = new CrispHooks();
		var results = [];
		crisphooks.hook('foo', function(arg) {}, function(error) {
			expect(error).to.equal(123);
			results.push('A');
		});
		crisphooks.hook('foo', function(arg) {}, function(error) {
			expect(error).to.equal(123);
			results.push('B');
		});
		crisphooks.hook('foo', function(arg) {}, function(error) {
			expect(error).to.equal(123);
			results.push('C');
		});
		crisphooks.triggerErrorSync('foo', 123);
		expect(results).to.deep.equal([ 'C', 'B', 'A' ]);
		done();
	});


	it('triggerWrap() should execute the relevant hooks', function(done) {
		var crisphooks = new CrispHooks();
		var results = [];
		crisphooks.hook('pre-foo', function(arg) {
			results.push('A' + arg);
			return delayResult(undefined);
		});
		crisphooks.hook('pre-foo', function(arg) {
			results.push('B' + arg);
			return delayResult(undefined);
		});
		crisphooks.hook('foo', function(arg) {
			results.push('C' + arg);
			return delayResult(undefined);
		});
		crisphooks.hook('foo', function(arg) {
			results.push('D' + arg);
			return delayResult(undefined);
		});
		crisphooks.hook('post-foo', function(arg) {
			results.push('F' + arg);
			return delayResult(undefined);
		});
		crisphooks.hook('post-foo', function(arg) {
			results.push('G' + arg);
			return delayResult(undefined);
		});
		crisphooks.triggerWrap('foo', function() {
			results.push('E');
			return delayResult(undefined);
		}, 1).then(function() {
			expect(results).to.deep.equal([ 'A1', 'B1', 'C1', 'D1', 'E', 'F1', 'G1' ]);
			done();
		}).catch(done);
	});

	it('triggerWrap() should execute error handlers', function(done) {
		var crisphooks = new CrispHooks();
		var results = [];
		crisphooks.hook('pre-foo', function() {}, function(arg) {
			results.push('A' + arg);
			return delayResult(undefined);
		});
		crisphooks.hook('pre-foo', function() {}, function(arg) {
			results.push('B' + arg);
			return delayResult(undefined);
		});
		crisphooks.hook('foo', function() {}, function(arg) {
			results.push('C' + arg);
			return delayResult(undefined);
		});
		crisphooks.hook('foo', function() {}, function(arg) {
			results.push('D' + arg);
			return delayResult(undefined);
		});
		crisphooks.hook('post-foo', function() {}, function(arg) {
			results.push('F' + arg);
			return delayResult(undefined);
		});
		crisphooks.hook('post-foo', function() {
			return delayError(123);
		}, function(arg) {
			results.push('G' + arg);
			return delayResult(undefined);
		});
		crisphooks.triggerWrap('foo', function() {
			results.push('E');
			return delayResult(undefined);
		}, 1).then(function() {
			done(new Error('should not reach'));
		}, function(error) {
			expect(error).to.equal(123);
			expect(results).to.deep.equal([ 'E', 'F123', 'D123', 'C123', 'B123', 'A123' ]);
			done();
		}).catch(done);
	});

	it('should support EventEmitter-style hooks', function(done) {
		var crisphooks = new (EventEmitterMixin(CrispHooks))();
		var results = [];
		crisphooks.on('foo', function(arg) {
			results.push('A' + arg);
		});
		crisphooks.on('foo', function(arg) {
			results.push('B' + arg);
		});
		crisphooks.emit('foo', 1);
		expect(results).to.deep.equal([ 'A1', 'B1' ]);
		done();
	});

	it('CrispPrePostHooks()', function(done) {
		var crisphooks = new CrispPrePostHooks();
		var results = [];
		crisphooks.pre('foo', function() {
			results.push(1);
		});
		crisphooks.post('foo', function() {
			results.push(2);
		});
		crisphooks.triggerPre('foo').then(function() {
			expect(results).to.deep.equal([ 1 ]);
			return crisphooks.triggerPost('foo');
		}).then(function() {
			expect(results).to.deep.equal([ 1, 2 ]);
			done();
		}).catch(done);
	});

});
