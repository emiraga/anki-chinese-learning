import React from "react";

import { Tooltip } from "@base-ui-components/react/tooltip";
import styles from "./index.module.css";
import "../data/characters";
import { CharCard } from "./CharCard";
import { PinyinText } from "./PinyinText";
import type { KnownSoundsType } from "../data/characters";

export const PinyinCell: React.FC<{
  value: string;
  knownSounds: KnownSoundsType;
}> = ({ value, knownSounds }) => {
  if (knownSounds[value] === undefined || !knownSounds[value]) {
    return <></>;
  }
  if (Object.values(knownSounds[value])[0].length === 0) {
    return <></>;
  }
  let isSingle = Object.values(knownSounds[value]).length === 1;
  let pinyin1 = isSingle
    ? Object.values(knownSounds[value])[0][0].pinyin_1
    : value;
  let tone = isSingle ? Object.values(knownSounds[value])[0][0].tone : 0;
  let sylable = Object.values(knownSounds[value])[0][0].sylable;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        aria-label="Bold"
        className={styles.Button}
        style={isSingle ? {} : { fontWeight: "bolder" }}
      >
        <PinyinText v={{ pinyin_1: pinyin1, tone, sylable }} />
      </Tooltip.Trigger>

      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={10}>
          <Tooltip.Popup className={styles.Popup}>
            {Object.entries(knownSounds[value]).map(([tone, values]) => {
              return (
                <div key={tone}>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Tone {tone}
                  </div>
                  {values.map((v, i) => {
                    return <CharCard key={i} v={v} />;
                  })}
                </div>
              );
            })}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};
