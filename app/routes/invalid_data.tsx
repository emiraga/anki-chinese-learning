import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/index";
import type { OutletContext } from "~/data/types";
import { useOutletContext } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Invalid Data" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function InvalidData() {
  const { invalidData } = useOutletContext<OutletContext>();

  return (
    <MainFrame>
      <section className="block mx-4">
        <h3 className="font-serif text-4xl m-4">
          Encountered invalid data: ({invalidData.length})
        </h3>

        {invalidData.length === 0 ? (
          <p>No errors to display.</p>
        ) : (
          <ul>
            {invalidData.map((error, index) => (
              <li key={index} className="mb-2 p-2 border rounded">
                <p className="font-bold">{error.message}</p>
                {error.details && (
                  <pre className="mt-2 p-2 rounded ">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </MainFrame>
  );
}
