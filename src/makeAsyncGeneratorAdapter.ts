import { primeAsyncTerminator, AsyncTerminator } from "./Terminator";

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
	job: (asyncTerminator: AsyncTerminator, done: () => void) => void,
) {
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

	let resolveDone: (symbol: Symbol) => void | undefined;
	const done = new Promise<Symbol>(resolve => {
		resolveDone = resolve;
	});
	const doneSymbol = Symbol();

	const asyncTerminator = primeAsyncTerminator(
		async function*(): AsyncTerminator {
			for (;;) {
				try {
					const data: T = yield;
					newData.resolve(data);
				} catch (error) {
					newData.reject(error);
					return;
				}

				await handled.promise;
				setHandledPromise();
			}
		},
	)();

	job(asyncTerminator, () => resolveDone(doneSymbol));

	return (async function* asyncGenerator() {
		for (;;) {
			const data = await Promise.race([done, newData!.promise]);
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
