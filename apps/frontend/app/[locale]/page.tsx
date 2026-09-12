import { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "cms";
import { Link } from "@/i18n/navigation";
import { formatLabel } from "@/lib/format-label";
import { SearchSection } from "@/components/search-section";

type HomePageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  // setRequestLocale must run before any other next-intl call in this
  // function, and again in the page component below — next-intl needs it
  // in every page/layout that should stay statically rendered, since Next
  // can invoke generateMetadata and the page independently.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "HomePage" });
  // No `title` here: the root layout's default title *is* this site title,
  // and the layout's "%s | <site title>" template would otherwise double it
  // up (e.g. "Site | Site") for this one page.
  return { description: t("description") };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "HomePage" });
  const client = createClient();
  const pages = await client.getAllByType("content_page");

  return (
    <div className="mx-auto max-w-[800px] p-6">
      <SearchSection />

      <h1 className="mt-10 mb-2 text-4xl font-semibold">{t("title")}</h1>
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
