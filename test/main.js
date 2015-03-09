var expect = require('chai').expect;
var CrispHooks = require('../crisphooks');
var Promise = require('es6-promise').Promise;

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
		crisphooks.hook('foo', 2, function(arg) {
			return delayResult('A' + arg);
		});
		crisphooks.hook('foo', 3, function(arg) {
			return delayResult('B' + arg);
		});
		crisphooks.hook('foo', 1, function(arg) {
			return delayResult('C' + arg);
		});
		crisphooks.trigger('foo', 1).then(function(result) {
			expect(result).to.deep.equal([ 'C1', 'A1', 'B1' ]);
			done();
		}).catch(done);
	});

	it('should execute hooks with the correct this', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hook('foo', function(arg) {
			expect(this).to.equal(crisphooks);
			return delayResult('A' + arg);
		});
		crisphooks.hook('foo', function(arg) {
			expect(this).to.equal(crisphooks);
			return delayResult('B' + arg);
		});
		crisphooks.hook('foo', function(arg) {
			expect(this).to.equal(crisphooks);
			return delayResult('C' + arg);
		});
		crisphooks.trigger('foo', 1).then(function(result) {
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
		crisphooks.hook('foo', 1, function(arg) {
			results.push('A');
			return delayResult('A' + arg);
		}, function(error, arg) {
			results.push('eA');
			expect(error).to.equal(123);
			expect(arg).to.equal(1);
		});
		crisphooks.hook('foo', 2, function(arg) {
			results.push('B');
			return delayResult('B' + arg);
		}, function(error, arg) {
			results.push('eB');
			expect(error).to.equal(123);
			expect(arg).to.equal(1);
			return delayResult();
		});
		crisphooks.hook('foo', 3, function(arg) {
			results.push('C');
			return delayError(123);
		}, function(error, arg) {
			results.push('eC');
			throw new Error('should not reach');
		});
		crisphooks.trigger('foo', 1).then(function() {
			done(new Error('should not reach'));
		}, function(error) {
			expect(error).to.equal(123);
			expect(results).to.deep.equal([ 'A', 'B', 'C', 'eB', 'eA' ]);
			done();
		}).catch(done);
	});

	it('should execute hooks registered with hookSync', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hookSync('foo', function(arg) {
			return 'A' + arg;
		});
		crisphooks.hookSync('foo', function(arg) {
			return 'B' + arg;
		});
		crisphooks.hookSync('foo', function(arg) {
			return 'C' + arg;
		});
		crisphooks.trigger('foo', 1).then(function(result) {
			expect(result).to.deep.equal([ 'A1', 'B1', 'C1' ]);
			done();
		}).catch(done);
	});

	it('should execute hooks with callbacks registered with hookAsync', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hookAsync('foo', function(next, arg) {
			next(null, 'A' + arg);
		});
		crisphooks.hookAsync('foo', function(next, arg) {
			next(null, 'B' + arg);
		});
		crisphooks.hook('foo', function(arg) {
			return delayResult('C' + arg);
		});
		crisphooks.trigger('foo', 1).then(function(result) {
			expect(result).to.deep.equal([ 'A1', 'B1', 'C1' ]);
			done();
		}).catch(done);
	});

	it('should handle errors with callbacks registered with hookAsync', function(done) {
		var crisphooks = new CrispHooks();
		crisphooks.hookAsync('foo', function(next, arg) {
			next(null, 'A' + arg);
		});
		crisphooks.hookAsync('foo', function(next, arg) {
			next(123);
		});
		crisphooks.hook('foo', function(arg) {
			return delayResult('C' + arg);
		});
		crisphooks.trigger('foo', 1).then(function(result) {
			done(new Error('should not reach'));
		}, function(error) {
			expect(error).to.equal(123);
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
			return delayResult();
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

	it('triggerAsync()', function(done) {
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
		crisphooks.triggerAsync('foo', 1, function(error, result) {
			expect(error).to.not.exist;
			expect(result).to.deep.equal([ 'A1', 'B1', 'C1' ]);
			done();
		});
	});

	it('triggerErrorAsync()', function(done) {
		var crisphooks = new CrispHooks();
		var results = [];
		crisphooks.hook('foo', function(arg) {}, function(error) {
			expect(error).to.equal(123);
			results.push('A');
		});
		crisphooks.hook('foo', function(arg) {}, function(error) {
			expect(error).to.equal(123);
			results.push('B');
			return delayResult();
		});
		crisphooks.hook('foo', function(arg) {}, function(error) {
			expect(error).to.equal(123);
			results.push('C');
		});
		crisphooks.triggerErrorAsync('foo', 123, function() {
			expect(results).to.deep.equal([ 'C', 'B', 'A' ]);
			done();
		});
	});

	it('triggerWrap() should execute the relevant hooks', function(done) {
		var crisphooks = new CrispHooks();
		var results = [];
		crisphooks.hook('pre-foo', function(arg) {
			results.push('A' + arg);
			return delayResult();
		});
		crisphooks.hook('pre-foo', function(arg) {
			results.push('B' + arg);
			return delayResult();
		});
		crisphooks.hook('foo', function(arg) {
			results.push('C' + arg);
			return delayResult();
		});
		crisphooks.hook('foo', function(arg) {
			results.push('D' + arg);
			return delayResult();
		});
		crisphooks.hook('post-foo', function(arg) {
			results.push('F' + arg);
			return delayResult();
		});
		crisphooks.hook('post-foo', function(arg) {
			results.push('G' + arg);
			return delayResult();
		});
		crisphooks.triggerWrap('foo', function(arg) {
			results.push('E' + arg);
			return delayResult();
		}, 1).then(function() {
			expect(results).to.deep.equal([ 'A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1' ]);
			done();
		}).catch(done);
	});

	it('triggerWrap() should execute error handlers', function(done) {
		var crisphooks = new CrispHooks();
		var results = [];
		crisphooks.hook('pre-foo', function() {}, function(arg) {
			results.push('A' + arg);
			return delayResult();
		});
		crisphooks.hook('pre-foo', function() {}, function(arg) {
			results.push('B' + arg);
			return delayResult();
		});
		crisphooks.hook('foo', function() {}, function(arg) {
			results.push('C' + arg);
			return delayResult();
		});
		crisphooks.hook('foo', function() {}, function(arg) {
			results.push('D' + arg);
			return delayResult();
		});
		crisphooks.hook('post-foo', function() {}, function(arg) {
			results.push('F' + arg);
			return delayResult();
		});
		crisphooks.hook('post-foo', function() {
			return delayError(123);
		}, function(arg) {
			results.push('G' + arg);
			return delayResult();
		});
		crisphooks.triggerWrap('foo', function(arg) {
			results.push('E' + arg);
			return delayResult();
		}, 1).then(function() {
			done(new Error('should not reach'));
		}, function(error) {
			expect(error).to.equal(123);
			expect(results).to.deep.equal([ 'E1', 'F123', 'D123', 'C123', 'B123', 'A123' ]);
			done();
		}).catch(done);
	});

	it('should support EventEmitter-style hooks', function(done) {
		var crisphooks = new CrispHooks({
			eventEmitter: true
		});
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
		var crisphooks = new CrispHooks.CrispPrePostHooks();
		crisphooks.biz = 10;
		var results = [];
		crisphooks.pre('foo', function(next) {
			results.push(this.biz + 1);
			next();
		});
		crisphooks.post('foo', function() {
			results.push(this.biz + 2);
		});
		crisphooks.triggerPre('foo').then(function() {
			expect(results).to.deep.equal([ 11 ]);
			return crisphooks.triggerPost('foo');
		}).then(function() {
			expect(results).to.deep.equal([ 11, 12 ]);
			done();
		}).catch(done);
	});

});
