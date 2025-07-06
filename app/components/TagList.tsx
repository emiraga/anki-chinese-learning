import { Link } from "react-router";

export const TagList: React.FC<{ tags: string[] }> = ({ tags }) => {
  return (
    <>
      {tags.map((t) => {
        if (t.startsWith("prop::")) {
          return (
            <Link
              key={t}
              to={`/prop/${t.substring(6)}`}
              className="rounded-sm bg-blue-100 text-sm mx-2 whitespace-break-spaces inline"
            >
              {t}
            </Link>
          );
        }
        if (t.startsWith("tone::")) {
          return (
            <Link
              key={t}
              to={`/tone/${t.substring(6)}`}
              className="rounded-sm bg-purple-100 text-sm mx-2 whitespace-break-spaces inline"
            >
              {t}
            </Link>
          );
        }
        if (t.startsWith("actor::")) {
          return (
            <Link
              key={t}
              to={`/actor/${t.substring(7)}`}
              className="rounded-sm bg-green-100 text-sm mx-2 whitespace-break-spaces inline"
            >
              {t}
            </Link>
          );
        }
        if (t.startsWith("place::")) {
          return (
            <Link
              key={t}
              to={`/place/${t.substring(7)}`}
              className="rounded-sm bg-yellow-100 text-sm mx-2 whitespace-break-spaces inline"
            >
              {t}
            </Link>
          );
        }
        return (
          <span
            key={t}
            className="rounded-sm bg-red-100 text-sm mx-2 whitespace-break-spaces inline"
          >
            <Link
              key={t}
              to={`/tag/${t}`}
              className="rounded-sm text-sm mx-2 whitespace-break-spaces inline"
            >
              {t}
            </Link>
          </span>
        );
      })}
    </>
  );
};
