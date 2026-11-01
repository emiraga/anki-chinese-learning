import { POS } from "./pos";
import { POS_COLOR_HEX, POS_COLORS } from "./pos_colors";

// pos_colors.json is cast to Record<PosCode, PosColor>, so check here that it
// covers exactly the codes of pos.json, with colors that have a hex value.
describe("POS_COLORS", () => {
  it("has a color for every POS code and no others", () => {
    expect(Object.keys(POS_COLORS).sort()).toEqual(Object.keys(POS).sort());
  });

  it("uses only colors with a hex value", () => {
    const unknown = Object.values(POS_COLORS).filter(
      (color) => !Object.hasOwn(POS_COLOR_HEX, color),
    );
    expect(unknown).toEqual([]);
  });

  it("has hex values of the form #rrggbb", () => {
    for (const hex of Object.values(POS_COLOR_HEX)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
