import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import { useOutletContext } from "react-router";
import type { OutletContext } from "~/data/types";
import { useState } from "react";
import { PhraseList } from "~/components/Phrase";
import { Pagination, usePagination } from "~/components/Pagination";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Phrases" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Phrases() {
  const { phrases } = useOutletContext<OutletContext>();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredPhrases =
    search.length > 0
      ? phrases.filter(
          (phrase) =>
            phrase.meaning.includes(search) ||
            phrase.traditional.includes(search) ||
            phrase.pinyin.includes(search)
        )
      : phrases;

  const { totalPages, getPaginatedItems } = usePagination(filteredPhrases, 50);
  const paginatedPhrases = getPaginatedItems(currentPage);

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <MainFrame>
      <h3 className="font-serif text-4xl m-4 text-gray-900 dark:text-gray-100">
        List of phrases: ({filteredPhrases.length})
        <input
          value={search}
          className="font-sans text-lg border ml-4 px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search..."
          onChange={(x) => {
            handleSearch(x.currentTarget.value);
          }}
        />
      </h3>

      <div className="mx-4 mb-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>

      <section className="block mx-4">
        <PhraseList phrases={paginatedPhrases} />
      </section>

      <div className="mx-4 mt-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </MainFrame>
  );
}
