import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient, PageContext, SliceRenderer } from "cms";

import { cn } from "@/lib/utils";

type PageProps = { params: { uid: string } };

export default async function Page({ params }: PageProps) {
  const client = createClient();
  const page = await client
    .getByUID("content_page", params.uid)
    .catch(() => notFound());

  // Not yet passed to SliceRenderer — it doesn't accept a context prop yet.
  // Needed once Breadcrumbs (or anything else reading page-level context) is migrated.
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
  void context;

  const hasAside = page.data.aside.length > 0;
  const hasFooter = page.data.footer.length > 0;

  return (
    <div
      className={cn(
        "mx-auto grid max-w-[1200px] grid-cols-1 gap-8 p-6",
        hasAside && "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]",
      )}
    >
      <div className="md:col-span-2">
        {page.data.heading.map((slice, index) => (
          <SliceRenderer key={`heading-${index}`} slice={slice} />
        ))}
      </div>

      <main className={cn("min-w-0", !hasAside && "md:col-span-2")}>
        {page.data.main.map((slice, index) => (
          <SliceRenderer key={`main-${index}`} slice={slice} />
        ))}
      </main>

      {hasAside ? (
        <aside className="min-w-0">
          {page.data.aside.map((slice, index) => (
            <SliceRenderer key={`aside-${index}`} slice={slice} />
          ))}
        </aside>
      ) : null}

      {hasFooter ? (
        <footer className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-4 md:col-span-2">
          {page.data.footer.map((slice, index) => (
            <SliceRenderer key={`footer-${index}`} slice={slice} />
          ))}
        </footer>
      ) : null}
    </div>
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const client = createClient();
  const page = await client
    .getByUID("content_page", params.uid)
    .catch(() => notFound());

  return { title: page.uid };
}

export async function generateStaticParams() {
  const client = createClient();
  const pages = await client.getAllByType("content_page");

  return pages.map((page) => ({ uid: page.uid! }));
}
