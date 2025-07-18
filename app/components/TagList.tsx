import { Link } from "react-router";

export const TagList: React.FC<{ tags: string[] }> = ({ tags }) => {
  return (
    <>
      {tags.map((t2) => {
        const t = t2.replaceAll("::", " ");
        if (t.startsWith("prop::")) {
          return (
            <Link
              key={t}
              to={`/prop/${t2.substring(6)}`}
              className="rounded-sm bg-blue-100 dark:bg-blue-800 dark:text-blue-100 text-sm mx-2 whitespace-break-spaces inline-block"
            >
              {t}
            </Link>
          );
        }
        if (t.startsWith("tone::")) {
          return (
            <Link
              key={t}
              to={`/tone/${t2.substring(6)}`}
              className="rounded-sm bg-purple-100 dark:bg-purple-800 dark:text-purple-100 text-sm mx-2 whitespace-break-spaces inline-block"
            >
              {t}
            </Link>
          );
        }
        if (t.startsWith("actor::")) {
          return (
            <Link
              key={t}
              to={`/actor/${t2.substring(7)}`}
              className="rounded-sm bg-green-100 dark:bg-green-800 dark:text-green-100 text-sm mx-2 whitespace-break-spaces inline-block"
            >
              {t}
            </Link>
          );
        }
        if (t.startsWith("place::")) {
          return (
            <Link
              key={t}
              to={`/place/${t2.substring(7)}`}
              className="rounded-sm bg-yellow-100 dark:bg-yellow-800 dark:text-yellow-100 text-sm mx-2 whitespace-break-spaces inline-block"
            >
              {t}
            </Link>
          );
        }
        return (
          <span
            key={t}
            className="rounded-sm bg-red-100 dark:bg-red-900 dark:text-red-100 text-sm mx-2 whitespace-break-spaces inline-block"
          >
            <Link
              key={t}
              to={`/tag/${t2}`}
              className="rounded-sm text-sm mx-2 whitespace-break-spaces inline-block"
            >
              {t}
            </Link>
          </span>
        );
      })}
    </>
  );
};
