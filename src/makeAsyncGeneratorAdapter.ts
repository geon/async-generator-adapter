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
	let handled = makePromiseAndCallbacks<void>();

	let newData:
		| { type: "data"; data: T }
		| { type: "error"; error: Error }
		| undefined;
	let done = false;

	job({
		next: (data: T) => {
			newData = { type: "data", data };
			return handled.promise;
		},
		throw: (error: Error) => {
			newData = { type: "error", error };
		},
	}).then(() => {
		done = true;
	});

	return (async function* asyncGenerator() {
		for (;;) {
			// Wait for the terminator to send data.
			// I previously used promises for that, but they created a
			// memory leak. So busy-loop it is.
			for (;;) {
				if (newData) {
					break;
				}
				if (done) {
					return;
				}
				await Promise.resolve();
			}

			if (newData.type === "error") {
				throw newData.error;
			}

			try {
				yield newData.data as T;
				newData = undefined;
				handled.resolve();
				handled = makePromiseAndCallbacks<void>();
			} catch (error) {
				handled.reject(error);
				return;
			}
		}
	})();
}
