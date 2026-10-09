// ioredis-mock ships no type declarations. It is only used in tests, where it is
// passed to RedisSessionStore, which needs just a few ioredis methods.
declare module "ioredis-mock" {
  const RedisMock: new (...args: unknown[]) => unknown;
  export default RedisMock;
}
