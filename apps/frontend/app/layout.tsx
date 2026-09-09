import { PrismicPreview } from "@prismicio/next";

import { repositoryName } from "cms";

import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Column layout so Footer's `mt-auto` pins it to the bottom on short pages. */}
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <PrismicPreview repositoryName={repositoryName} />
      </body>
    </html>
  );
}
