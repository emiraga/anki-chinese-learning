import MainFrame from "~/toolbar/frame";
import type { Route } from "./+types/$propName";
import { Link, useOutletContext, useParams } from "react-router";
import type { OutletContext } from "~/data/types";
import { PropCard } from "~/components/PropCard";
import { CharList } from "~/components/CharList";
import { CharCardDetails } from "~/components/CharCard";
import { PropList } from "~/components/PropList";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Prop: ${params.propName}` },
    { name: "description", content: `Details for prop ${params.propName}` },
  ];
}

const PropRender: React.FC<{
  propName: string;
  showConversionCandidates?: boolean;
}> = ({ propName, showConversionCandidates = false }) => {
  const { props, knownProps, characters } = useOutletContext<OutletContext>();
  const prop = knownProps[propName];
  if (!prop) {
    throw new Error("Prop not found: " + propName);
  }

  const currentIndex = props.findIndex((p) => p.mainTagname === propName);
  const nextProp =
    currentIndex < props.length - 1 ? props[currentIndex + 1].prop : null;

  const chars = Object.values(characters)
    .filter((c) => c.tags.includes(propName))
    .sort((a, b) => a.pinyin[0].sylable.localeCompare(b.pinyin[0].sylable));

  const subprops = prop.tagnames
    .filter((name) => name !== prop.mainTagname && name.startsWith("prop::"))
    .map((name) => knownProps[name]);

  const superprops = props.filter(
    (prop) => prop.tagnames.includes(propName) && prop.mainTagname !== propName
  );

  // Find conversion candidates: chars that have all sub-props but not the current prop
  const conversionCandidates =
    subprops.length > 1
      ? Object.values(characters).filter((char) => {
          // Must have all sub-props
          const hasAllSubProps = subprops.every((subprop) =>
            char.tags.includes(subprop.mainTagname)
          );
          // Must NOT have the current prop
          const hasCurrentProp = char.tags.includes(propName);
          return hasAllSubProps && !hasCurrentProp;
        })
      : [];

  return (
    <div>
      <hr className="my-4" />
      <h4 className="font-serif text-2xl mb-2">
        {propName}
        {nextProp !== null ? (
          <Link className="text-sm ml-5 float-right" to={"/prop/" + nextProp}>
            Next &gt;&gt;
          </Link>
        ) : undefined}
      </h4>
      <PropCard prop={prop} />
      {/* <hr className="my-4" /> */}
      {subprops.length > 0 ? (
        <div className="bg-gray-200 dark:bg-gray-800">
          <h4 className="font-semibold text-lg">Sub-props:</h4>
          <PropList props={subprops} />
        </div>
      ) : undefined}
      <hr className="my-4" />
      {superprops.length > 0 ? (
        <div className="bg-gray-200 dark:bg-gray-800">
          <h4 className="font-semibold text-lg">Super-props:</h4>
          <PropList props={superprops} />
        </div>
      ) : undefined}
      <hr className="my-4" />

      <CharList characters={chars} />
      {chars.map((char, i) => {
        return <CharCardDetails key={i} char={char} />;
      })}
      {showConversionCandidates && conversionCandidates.length > 0 ? (
        <div className="mt-8 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded">
          <h4 className="font-semibold text-lg mb-2">
            Conversion Candidates
            <span className="text-sm font-normal ml-2 text-gray-600 dark:text-gray-400">
              (Characters with all sub-props but missing this prop)
            </span>
          </h4>
          <CharList characters={conversionCandidates} />
        </div>
      ) : undefined}
      <div className="ml-10">
        {superprops.map((prop) => (
          <PropRender key={prop.prop} propName={prop.mainTagname} />
        ))}
      </div>
    </div>
  );
};

export default function PropDetail() {
  const { propName } = useParams();

  if (!propName) {
    throw new Error("Missing propName");
  }

  return (
    <MainFrame>
      <div className="mx-4">
        <h3 className="font-serif text-4xl">
          <Link to="/props" className="text-blue-800">
            Prop
          </Link>
          : {propName}
        </h3>
        <PropRender propName={"prop::" + propName} showConversionCandidates={true} />
      </div>
    </MainFrame>
  );
}
