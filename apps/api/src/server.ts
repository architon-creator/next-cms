// dotenv must load before instrumentation.ts, which reads OTEL_* env vars
// at import time — and instrumentation.ts must in turn stay before ./app.js
// (see its own header comment for why). Neither of these imports is
// express/http itself, so this ordering doesn't defeat the auto-
// instrumentation patching that instrumentation.ts sets up.
import "dotenv/config";
import "./instrumentation.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT) || 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`api listening on http://localhost:${port}`);
});
