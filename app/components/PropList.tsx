import type { PropType } from "~/data/props";
import { PropCard } from "./PropCard";

export const PropList: React.FC<{ props: PropType[]; miscTags?: string[] }> = ({
  props,
  miscTags = [],
}) => {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 mx-2">
      {props.map((prop, i) => (
        <div key={i}>
          <PropCard prop={prop} />
        </div>
      ))}
      {miscTags.map((tag) => (
        <div className="italic" key={tag}>
          {tag}
        </div>
      ))}
    </div>
  );
};
