export type MockIdpOptions = {
  port?: number;
  /** Public issuer URL; defaults to http://localhost:<port>. */
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUris?: string[];
  /** `aud` of the access tokens (what the Java API checks). */
  audience?: string;
  /** Access token lifetime in seconds. */
  accessTtl?: number;
  idTtl?: number;
  /** true: /authorize redirects straight back; false: shows a login button. */
  autoApprove?: boolean;
  scope?: string;
  user?: { sub: string; email: string; name: string };
};

export type MockIdp = {
  issuer: string;
  port: number;
  options: Required<Omit<MockIdpOptions, "issuer" | "port">> & {
    port: number;
    issuer?: string;
  };
  state: {
    codes: Map<string, unknown>;
    refresh: Map<string, unknown>;
    sessions: Set<string>;
    log: Array<{ type: string; sid?: string; clientId?: string | null }>;
  };
  close(): Promise<void>;
};

export function startMockIdp(options?: MockIdpOptions): Promise<MockIdp>;
