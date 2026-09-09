import { Metadata } from "next";
import { notFound } from "next/navigation";
import { SliceZone } from "@prismicio/react";

import { createClient } from "@/prismicio";
import { components, PageContext } from "@/slices";
import { cn } from "@/lib/utils";

type PageProps = { params: { uid: string } };

export default async function Page({ params }: PageProps) {
  const client = createClient();
  const page = await client
    .getByUID("content_page", params.uid)
    .catch(() => notFound());

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
        <SliceZone
          slices={page.data.heading}
          components={components}
          context={context}
        />
      </div>

      <main className={cn("min-w-0", !hasAside && "md:col-span-2")}>
        <SliceZone
          slices={page.data.main}
          components={components}
          context={context}
        />
      </main>

      {hasAside ? (
        <aside className="min-w-0">
          <SliceZone
            slices={page.data.aside}
            components={components}
            context={context}
          />
        </aside>
      ) : null}

      {hasFooter ? (
        <footer className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-4 md:col-span-2">
          <SliceZone
            slices={page.data.footer}
            components={components}
            context={context}
          />
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
