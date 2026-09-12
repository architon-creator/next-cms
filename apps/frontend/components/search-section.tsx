"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button, Input } from "ui";

import { useRouter } from "@/i18n/navigation";
import { MOCK_RESULTS } from "@/lib/mock-results";

export function SearchSection() {
  const t = useTranslations("SearchPage");
  const tResult = useTranslations("ResultCard");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState(MOCK_RESULTS);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();
    setResults(
      normalized
        ? MOCK_RESULTS.filter((result) => result.name.toLowerCase().includes(normalized))
        : MOCK_RESULTS,
    );
    setHasSearched(true);
  }

  function handleSelect() {
    router.push("/personal-details");
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">{t("heading")}</h1>

      <form onSubmit={handleSearch} className="flex gap-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("heading")}
          aria-label={t("heading")}
          className="flex-1"
        />
        <Button type="submit" size="lg">
          {t("searchButton")}
        </Button>
      </form>

      {hasSearched && results.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
      )}

      {hasSearched && results.length > 0 && (
        <ul className="flex list-none flex-col gap-2 p-0">
          {results.map((result) => (
            <li key={result.id} className="flex items-center justify-between border-b px-2 py-4">
              <div>
                <p className="font-semibold text-foreground">{result.name}</p>
                <p className="text-sm text-muted-foreground">{result.detail}</p>
              </div>
              <Button type="button" size="sm" onClick={handleSelect}>
                {tResult("selectAction")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
