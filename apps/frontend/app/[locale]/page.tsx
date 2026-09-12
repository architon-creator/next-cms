import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "cms";
import { Link } from "@/i18n/navigation";
import { formatLabel } from "@/lib/format-label";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("HomePage");
  return { title: t("title") };
}

export default async function HomePage() {
  const t = await getTranslations("HomePage");
  const client = createClient();
  const pages = await client.getAllByType("content_page");

  return (
    <div className="mx-auto max-w-[800px] p-6">
      <h1 className="mb-2 text-4xl font-semibold">{t("title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("description")}</p>

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
