import { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BreadcrumbsProvider, createClient, PageContext, SliceRenderer } from "cms";

import { cn } from "@/lib/utils";
import { formatLabel } from "@/lib/format-label";
import { getSliceContext } from "@/lib/slice-context";

type PageProps = { params: Promise<{ locale: string; uid: string }> };

export default async function Page({ params }: PageProps) {
  const { locale, uid } = await params;
  setRequestLocale(locale);
  const client = createClient();
  const page = await client.getByUID("content_page", uid).catch(() => notFound());

  const context: PageContext = {
    breadcrumbs: [
      {
        label: page.data.breadcrumb_level_1_label,
        href: page.data.breadcrumb_level_1_href,
      },
      {
        label: page.data.breadcrumb_level_2_label,
        href: page.data.breadcrumb_level_2_href,
      },
      {
        label: page.data.breadcrumb_level_3_label,
        href: page.data.breadcrumb_level_3_href,
      },
    ],
  };

  const sliceContext = getSliceContext(locale);
  const hasAside = page.data.aside.length > 0;
  const hasFooter = page.data.footer.length > 0;
  // Design order is always breadcrumbs above the title, whatever order the
  // editor left the Heading zone in (Array.sort is stable).
  const heading = [...page.data.heading].sort(
    (a, b) =>
      Number(b.slice_type === "breadcrumbs") - Number(a.slice_type === "breadcrumbs"),
  );

  return (
    <BreadcrumbsProvider breadcrumbs={context.breadcrumbs}>
      <div
        className={cn(
          "mx-auto grid grid-cols-1 px-6 pb-6",
          hasAside
            ? "max-w-[1200px] gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            : "max-w-[846px] gap-x-8 gap-y-0",
        )}
      >
        <div className="md:col-span-2">
          {heading.map((slice, index) => (
            <SliceRenderer key={`heading-${index}`} slice={slice} context={sliceContext} />
          ))}
        </div>

        <main className={cn("min-w-0", !hasAside && "md:col-span-2")}>
          {page.data.main.map((slice, index) => (
            <SliceRenderer key={`main-${index}`} slice={slice} context={sliceContext} />
          ))}
        </main>

        {hasAside ? (
          <aside className="min-w-0">
            {page.data.aside.map((slice, index) => (
              <SliceRenderer key={`aside-${index}`} slice={slice} context={sliceContext} />
            ))}
          </aside>
        ) : null}

        {hasFooter ? (
          <footer className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-4 md:col-span-2">
            {page.data.footer.map((slice, index) => (
              <SliceRenderer key={`footer-${index}`} slice={slice} context={sliceContext} />
            ))}
          </footer>
        ) : null}
      </div>
    </BreadcrumbsProvider>
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { uid } = await params;
  const client = createClient();
  const page = await client.getByUID("content_page", uid).catch(() => notFound());

  // Falls back to the slug when editors haven't filled in the Meta tab yet.
  const title = page.data.meta_title || formatLabel(page.uid!);
  const description = page.data.meta_description || undefined;

  return {
    title,
    description,
    alternates: { canonical: `/${page.uid}` },
    openGraph: { title, description, type: "article" },
  };
}

export async function generateStaticParams() {
  const client = createClient();
  const pages = await client.getAllByType("content_page");

  return pages.map((page) => ({ uid: page.uid! }));
}
