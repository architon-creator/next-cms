import { LoggerProvider } from "@opentelemetry/sdk-logs";

let loggerProvider: LoggerProvider | null = null;

export function initializeLoggerProvider() {
  if (loggerProvider) return loggerProvider;

  loggerProvider = new LoggerProvider();

  // Logs are collected by the LoggerProvider; @vercel/otel handles
  // exporting them automatically alongside traces.

  return loggerProvider;
}

export function getLogger(name: string) {
  const provider = initializeLoggerProvider();
  return provider.getLogger(name);
}
