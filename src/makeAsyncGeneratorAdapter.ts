interface PromiseAndCallbacks<T> {
	promise: Promise<T>;
	resolve: (data: T) => void;
	reject: (error: Error) => void;
}

function makePromiseAndCallbacks<T>(): PromiseAndCallbacks<T> {
	let resolve!: (data: T) => void;
	let reject!: (error: Error) => void;

	const promise: Promise<T> = new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return {
		promise,
		resolve,
		reject,
	};
}

export function makeAsyncGeneratorAdapter<T>(
	job: (iterator: {
		next: (data: T) => Promise<IteratorResult<undefined>>;
		throw: (error: Error) => Promise<IteratorResult<undefined>>;
	}) => Promise<void>,
): AsyncIterableIterator<T> {
	let newData: PromiseAndCallbacks<T>;

	function setNewDataPromise() {
		newData = makePromiseAndCallbacks<T>();
	}
	setNewDataPromise();

	let handled: PromiseAndCallbacks<void>;

	function setHandledPromise() {
		handled = makePromiseAndCallbacks<void>();
	}
	setHandledPromise();

	const done = makePromiseAndCallbacks<Symbol>();
	const doneSymbol = Symbol();

	const asyncTerminator = (async function*() {
		for (;;) {
			try {
				const data: T = yield;
				newData!.resolve(data);
			} catch (error) {
				newData!.reject(error);
				return;
			}

			await handled!.promise;
			setHandledPromise();
		}
	})();

	// Prime it, pausing at the yield.
	asyncTerminator.next();

	job({ next: asyncTerminator.next, throw: asyncTerminator.throw! }).then(() =>
		done.resolve(doneSymbol),
	);

	return (async function* asyncGenerator() {
		for (;;) {
			const data = await Promise.race([done.promise, newData!.promise]);
			setNewDataPromise();

			if (data === doneSymbol) {
				return;
			}

			try {
				yield data as T;
				handled!.resolve();
			} catch (error) {
				handled!.reject(error);
				return;
			}
		}
	})();
}
