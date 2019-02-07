export interface AsyncTerminator extends AsyncIterableIterator<void> {}
export interface Terminator extends IterableIterator<void> {}

export function primeAsyncTerminator<
	T extends (...args: Array<any>) => AsyncTerminator
>(unPrimed: T): T {
	return function(...args: Array<any>) {
		const generator = unPrimed(...args);

		// Prime it, so it will start right after the yield.
		generator.next();

		return generator;
	} as any; // Don't know why I need the cast.
}

// `.next(data: string): void`
export function primeTerminator<
	T extends (...args: Array<any>) => IterableIterator<void>
>(unPrimed: T): T {
	return function(...args: Array<any>) {
		const generator = unPrimed(...args);

		// Prime it, so it will start right after the yield.
		generator.next();

		return generator;
	} as any; // Don't know why I need the cast.
}
