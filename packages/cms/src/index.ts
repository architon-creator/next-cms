// Pulls the generated `declare module "@prismicio/client"` augmentation (the
// `Content` namespace the slices import) into any consumer's program. Consumers
// compile from their own tsconfig, which only sees this package through its
// entry point, so without this reference `Content` resolves nowhere for them.
/// <reference path="../prismicio-types.d.ts" />

export * from "./slices";
export * from "./prismicio";
