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

interface AsyncTerminator<T> {
	next: (data: T) => Promise<void>;
	throw: (error: Error) => void;
}

export function makeAsyncGeneratorAdapter<T>(
	job: (iterator: AsyncTerminator<T>) => Promise<void>,
): AsyncIterableIterator<T> {
	let newData = makePromiseAndCallbacks<T>();
	let handled = makePromiseAndCallbacks<void>();

	const done = makePromiseAndCallbacks<Symbol>();
	const doneSymbol = Symbol();

	job({
		next: (data: T) => {
			newData.resolve(data);
			return handled.promise;
		},
		throw: (error: Error) => {
			newData.reject(error);
		},
	}).then(() => done.resolve(doneSymbol));

	return (async function* asyncGenerator() {
		for (;;) {
			const data = await Promise.race([done.promise, newData.promise]);
			newData = makePromiseAndCallbacks<T>();

			if (data === doneSymbol) {
				return;
			}

			try {
				yield data as T;
				handled.resolve();
				handled = makePromiseAndCallbacks<void>();
			} catch (error) {
				handled.reject(error);
				return;
			}
		}
	})();
}
