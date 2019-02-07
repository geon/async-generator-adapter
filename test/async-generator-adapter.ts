import test from "tape";
import { makeAsyncGeneratorAdapter } from "../src/makeAsyncGeneratorAdapter";

test("AsyncGeneratorAdapter", t => {
	(async () => {
		const writeStrings = "Is that an async generator in your pocket, or are you just happy to see me?".split(
			" ",
		);

		{
			const asyncGenerator = makeAsyncGeneratorAdapter<string>(
				async (asyncTerminator, done) => {
					for (const write of writeStrings) {
						await asyncTerminator.next(write);
					}
					done();
				},
			);

			const readStrings = [];
			for await (const read of asyncGenerator) {
				readStrings.push(read);
			}

			t.deepEqual(
				readStrings,
				writeStrings,
				"Basic termination and generation.",
			);
		}

		{
			const thrownError = new Error("fake");

			const asyncGenerator = makeAsyncGeneratorAdapter<string>(
				async asyncTerminator => {
					try {
						await asyncTerminator.next("");
						t.fail("Should throw.");
					} catch (caughtError) {
						t.deepEqual(
							caughtError,
							thrownError,
							"Manual throw at the generator end.",
						);
					}
				},
			);

			try {
				// Must stop at a yield to be able to catch the throw.
				await asyncGenerator.next();
				await asyncGenerator.throw!(thrownError);
			} catch (caughtError) {
				t.fail("Should not throw.");
			}
		}

		{
			const thrownError = new Error("fake");

			const asyncGenerator = makeAsyncGeneratorAdapter<string>(
				async asyncTerminator => {
					try {
						await asyncTerminator.throw!(thrownError);
					} catch (caughtError) {
						t.fail("Should not throw.");
					}
				},
			);

			try {
				await asyncGenerator.next();
				t.fail("Should throw.");
			} catch (caughtError) {
				t.deepEqual(
					caughtError,
					thrownError,
					"Manual throw at the terminator end.",
				);
			}
		}

		t.end();
	})();
});
