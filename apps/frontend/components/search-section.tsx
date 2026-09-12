"use client";

import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button, Card, Input } from "ui";

import { useRouter } from "@/i18n/navigation";
import { MOCK_RESULTS } from "@/lib/mock-results";
import { useAppDispatch } from "@/store/hooks";
import { startNewFlow } from "@/store/slices/progress-slice";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function SearchSection() {
  const t = useTranslations("SearchPage");
  const tResult = useTranslations("ResultCard");
  const router = useRouter();
  const dispatch = useAppDispatch();
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
    // A search result starts a brand new run of the flow — any progress
    // left over from a previously completed run must not carry into it.
    dispatch(startNewFlow());
    router.push("/personal-details");
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("heading")}</h1>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("heading")}
          aria-label={t("heading")}
          className="h-11 flex-1 text-base"
        />
        <Button type="submit" size="lg" className="h-11 px-6">
          {t("searchButton")}
        </Button>
      </form>

      {hasSearched && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("emptyState")}</p>
        </div>
      )}

      {hasSearched && results.length > 0 && (
        <Card className="[--card-spacing:0]">
          <ul className="flex list-none flex-col p-0">
            {results.map((result, index) => (
              <li
                key={result.id}
                className={
                  index === 0
                    ? "flex items-center justify-between gap-4 p-4"
                    : "flex items-center justify-between gap-4 border-t p-4"
                }
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {initials(result.name)}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{result.name}</p>
                    <p className="text-sm text-muted-foreground">{result.detail}</p>
                  </div>
                </div>
                <Button type="button" size="sm" onClick={handleSelect}>
                  {tResult("selectAction")}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
