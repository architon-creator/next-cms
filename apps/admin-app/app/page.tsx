import Link from "next/link";

// Placeholder home page — admin-app is meant to grow other ibe-app/top-app
// configuration tools beyond migrations; this just needs to exist and link
// out until there's more than one thing to land on.
export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "80px auto",
        padding: "0 20px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>admin-app</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>
        Internal configuration and operations tools for ibe-app and top-app.
      </p>
      <Link
        href="/migrations"
        style={{
          display: "inline-block",
          background: "var(--accent)",
          color: "#fff",
          padding: "10px 18px",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 13,
          textDecoration: "none",
        }}
      >
        Prismic migrations →
      </Link>
    </main>
  );
}
