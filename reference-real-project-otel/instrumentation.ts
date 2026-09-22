// Next.js automatically calls the exported `register()` function from this
// file once per runtime it loads — including the Edge runtime if this app
// has any middleware/proxy. otel's register() wraps @vercel/otel, which is
// Node-only (importing it on Edge throws deep inside its Node-specific SDK
// setup). Gating on NEXT_RUNTIME keeps the Node-only import out of the Edge
// bundle entirely and skips calling it there.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { register: registerOtel } = await import("otel");
    registerOtel();
  }
}
