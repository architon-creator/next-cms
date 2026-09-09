import Link from "next/link";
import { Metadata } from "next";
import { createClient } from "cms";

export const metadata: Metadata = {
  title: "Home",
};

function formatLabel(uid: string) {
  return uid
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function HomePage() {
  const client = createClient();
  const pages = await client.getAllByType("content_page");

  return (
    <div className="mx-auto max-w-[800px] p-6">
      <h1 className="mb-2 text-4xl font-semibold">Welcome</h1>
      <p className="mb-8 text-muted-foreground">
        This is a Prismic-powered content site. Browse the available pages below.
      </p>

      <ul className="flex list-none flex-col gap-2 p-0">
        {pages.map((page) => (
          <li key={page.id} className="border-b">
            <Link
              href={`/${page.uid}`}
              className="flex items-center justify-between px-2 py-4 text-inherit no-underline hover:bg-accent"
            >
              <span className="font-semibold text-foreground">
                {formatLabel(page.uid!)}
              </span>
              <span className="text-primary">&rsaquo;</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
