import React from "react";
import type {
  PlecoComponent,
  PlecoMeaning,
  PlecoMeaningBlock,
  PlecoOutlierEntry,
  PlecoReading,
  PlecoStrokes,
  RichNode,
  RichText as RichTextValue,
} from "~/types/pleco_outlier_dictionary";
import { PLECO_OUTLIER_DIR } from "~/hooks/usePlecoOutlierDictionary";
import { CharLink } from "./CharCard";

/** Id (and URL hash) of the Pleco Outlier tab on the character page */
export const PLECO_OUTLIER_TAB = "plecooutlier";

function glyphUrl(id: number): string {
  return `${PLECO_OUTLIER_DIR}/tc_pngs/${id}.png`;
}

function pageUrl(page: number): string {
  return `${PLECO_OUTLIER_DIR}/tc_pages_html/${page}.html`;
}

// Glyph images are black on transparent, so they are inverted in dark mode.
// Diagrams are colored (red over grey) and keep their colors.
function Glyph({
  id,
  className,
  colored = false,
}: {
  id: number;
  className: string;
  colored?: boolean;
}) {
  return (
    <img
      src={glyphUrl(id)}
      alt={`${colored ? "diagram" : "glyph"} ${id}`}
      className={colored ? className : `${className} dark:invert`}
    />
  );
}

function PageLink({
  page,
  children,
}: {
  page: number;
  children: React.ReactNode;
}) {
  return (
    <a
      href={pageUrl(page)}
      target="_blank"
      rel="noreferrer"
      className="text-blue-600 dark:text-blue-400 hover:underline"
    >
      {children}
    </a>
  );
}

function RichNodeView({ node }: { node: RichNode }) {
  switch (node.type) {
    case "text":
      return <>{node.text}</>;
    case "pinyin":
      return <span className="italic">{node.text}</span>;
    case "glyph":
      return (
        <Glyph
          id={node.id}
          className="inline-block h-[1.2em] align-text-bottom"
        />
      );
    case "link":
      return <PageLink page={node.page}>{node.text}</PageLink>;
    case "xref": {
      const display = <RichText value={node.display} />;
      if (!node.character) return display;
      return (
        <CharLink
          hash={PLECO_OUTLIER_TAB}
          traditional={node.character}
          className="text-blue-600 dark:text-blue-400 hover:underline"
          title={node.pinyin ?? undefined}
        >
          {display}
        </CharLink>
      );
    }
    case "diagram":
      // How the simplified form derives from the traditional one.
      return <Glyph id={node.id} className="block h-24 my-2" colored />;
    case "lineBreak":
      return <br />;
    case "paragraphBreak":
      return <span className="block h-3" />;
  }
}

export function RichText({ value }: { value: RichTextValue }) {
  return (
    <>
      {value.map((node, index) => (
        <RichNodeView key={index} node={node} />
      ))}
    </>
  );
}

// Ancient forms are images, shown larger than glyphs in running text.
function AncientForm({ content }: { content: RichTextValue }) {
  return (
    <span className="inline-flex flex-wrap items-end gap-2 my-2">
      {content.map((node, index) =>
        node.type === "glyph" ? (
          <Glyph key={index} id={node.id} className="h-24" />
        ) : (
          <RichNodeView key={index} node={node} />
        ),
      )}
    </span>
  );
}

function SubSection({
  title,
  helpPage,
  children,
}: {
  title: string;
  helpPage?: number | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
        {helpPage != null && (
          <span className="ml-3 normal-case font-normal tracking-normal">
            <PageLink page={helpPage}>How to use this info</PageLink>
          </span>
        )}
      </h3>
      {children}
    </div>
  );
}

function Callout({
  color,
  children,
}: {
  color: "indigo" | "teal";
  children: React.ReactNode;
}) {
  const colors = {
    indigo:
      "bg-indigo-50 dark:bg-indigo-950 border-indigo-500 dark:border-indigo-400",
    teal: "bg-teal-50 dark:bg-teal-950 border-teal-500 dark:border-teal-400",
  };
  return (
    <div
      className={`text-gray-700 dark:text-gray-300 leading-relaxed p-4 border-l-4 rounded ${colors[color]}`}
    >
      {children}
    </div>
  );
}

function ComponentItem({ component }: { component: PlecoComponent }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-12 flex flex-col items-center">
        <div className="text-3xl font-serif leading-none">
          <RichText value={component.name} />
        </div>
        {component.systemPage != null && (
          <span className="text-xs mt-1">
            <PageLink page={component.systemPage}>[S]</PageLink>
          </span>
        )}
      </div>
      <div className="flex-1">
        <RichText value={component.text} />
      </div>
    </div>
  );
}

function MeaningItem({ meaning }: { meaning: PlecoMeaning }) {
  return (
    <li
      className="flex gap-2"
      style={{ marginLeft: `${meaning.depth * 1.5}rem` }}
    >
      {meaning.number && (
        <span className="font-semibold text-gray-500 dark:text-gray-400 shrink-0">
          {meaning.number}.
        </span>
      )}
      {meaning.marker && (
        <span className="text-gray-500 dark:text-gray-400 shrink-0">
          {meaning.marker}
        </span>
      )}
      <span>
        {meaning.tags.length > 0 && (
          <span className="italic text-gray-500 dark:text-gray-400 mr-1">
            (<RichText value={meaning.tags} />)
          </span>
        )}
        <RichText value={meaning.text} />
      </span>
    </li>
  );
}

function ReadingItem({ reading }: { reading: PlecoReading }) {
  return (
    <div className="space-y-2">
      {reading.pronunciation.length > 0 && (
        <div className="text-lg font-medium text-gray-800 dark:text-gray-200">
          <RichText value={reading.pronunciation} />
        </div>
      )}
      {reading.meanings.length > 0 && (
        <ul className="space-y-1">
          {reading.meanings.map((meaning, index) => (
            <MeaningItem key={index} meaning={meaning} />
          ))}
        </ul>
      )}
      {reading.notes.map((note, index) => (
        <div key={index} className="text-sm">
          <RichText value={note.text} />
          {note.items.length > 0 && (
            <ul className="ml-6 mt-1 space-y-1">
              {note.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-2">
                  {item.number && (
                    <span className="font-semibold text-gray-500 dark:text-gray-400">
                      {item.number}.
                    </span>
                  )}
                  <span>
                    <RichText value={item.text} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function MeaningBlockItem({ block }: { block: PlecoMeaningBlock }) {
  return (
    <div className="space-y-3">
      {block.label && (
        <div className="font-semibold">
          <RichText value={block.label} />
        </div>
      )}
      {block.readings.map((reading, index) => (
        <ReadingItem key={index} reading={reading} />
      ))}
    </div>
  );
}

function StrokesView({ strokes }: { strokes: PlecoStrokes }) {
  return (
    <div className="space-y-2">
      {strokes.rows.map((row, index) => (
        <div key={index} className="flex flex-wrap gap-1">
          {row.map((id) => (
            <Glyph key={id} id={id} className="h-14" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** One Pleco Outlier dictionary entry. */
export function PlecoOutlierEntryDisplay({
  entry,
}: {
  entry: PlecoOutlierEntry;
}) {
  const { form } = entry;
  const hasForm =
    form != null && (form.text.length > 0 || form.ancientForms.length > 0);

  return (
    <div className="space-y-6">
      {hasForm && (
        <SubSection title="Form">
          <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
            <RichText value={form.text} />
            {form.ancientForms.map((ancientForm, index) => (
              <div key={index} className="mt-3">
                <div className="text-sm font-semibold">{ancientForm.label}</div>
                <AncientForm content={ancientForm.content} />
              </div>
            ))}
          </div>
        </SubSection>
      )}

      {entry.components.length > 0 && (
        <SubSection title="Components" helpPage={entry.componentsHelpPage}>
          <Callout color="indigo">
            <div className="space-y-4">
              {entry.components.map((component, index) => (
                <ComponentItem key={index} component={component} />
              ))}
            </div>
          </Callout>
        </SubSection>
      )}

      {entry.meanings.length > 0 && (
        <SubSection title="Meanings" helpPage={entry.meaningsHelpPage}>
          <Callout color="teal">
            <div className="space-y-6">
              {entry.meanings.map((block, index) => (
                <MeaningBlockItem key={index} block={block} />
              ))}
            </div>
          </Callout>
        </SubSection>
      )}

      {entry.strokes && (
        <SubSection title={`Stroke order (${entry.strokes.count} strokes)`}>
          <StrokesView strokes={entry.strokes} />
        </SubSection>
      )}

      {(entry.expertPage != null || entry.componentPage != null) && (
        <div className="flex gap-4 text-sm">
          {entry.expertPage != null && (
            <PageLink page={entry.expertPage}>Expert info</PageLink>
          )}
          {entry.componentPage != null && (
            <PageLink page={entry.componentPage}>
              System level info for this component
            </PageLink>
          )}
        </div>
      )}

      {entry.sponsor && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <RichText value={entry.sponsor} />
        </div>
      )}
    </div>
  );
}
