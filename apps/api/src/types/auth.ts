export type User = {
  id: string;
  email: string;
  name: string;
  /** bcrypt hash — never the plaintext, and never serialized to a response. */
  passwordHash: string;
};

/** The subset of a user that is safe to send to a client. */
export type PublicUser = Pick<User, "id" | "email" | "name">;

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  /** Seconds until `token` expires, for the caller to age its own cookie. */
  expiresIn: number;
  user: PublicUser;
};

/** Claims this API puts in — and expects back out of — its own tokens. */
export type SessionClaims = {
  sub: string;
  email: string;
  name: string;
};
