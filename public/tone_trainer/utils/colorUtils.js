import { COLOR_MAPS } from "./constants.js";

export function interpolateColor(c1, c2, factor) {
  const result = c1.slice();
  for (let i = 0; i < 3; i++) {
    result[i] = Math.round(result[i] + factor * (c2[i] - result[i]));
  }
  return result;
}

export function getColor(value, schemeName) {
  const map = COLOR_MAPS[schemeName];
  const scaledValue = (value / 255) * (map.length - 1);
  const colorIndex = Math.floor(scaledValue);
  const factor = scaledValue - colorIndex;

  if (colorIndex >= map.length - 1) {
    return map[map.length - 1];
  }
  return interpolateColor(map[colorIndex], map[colorIndex + 1], factor);
}

export function getPitchPointColor(correction, alpha) {
  if (!correction || correction === "none") {
    return `rgba(255, 255, 255, ${alpha})`;
  }

  switch (correction) {
    case "up_2x":
      return `rgba(255, 100, 100, ${alpha})`;
    case "up_4x":
      return `rgba(255, 50, 50, ${alpha})`;
    case "down_2x":
      return `rgba(100, 150, 255, ${alpha})`;
    case "down_4x":
      return `rgba(50, 100, 255, ${alpha})`;
    default:
      return `rgba(255, 255, 255, ${alpha})`;
  }
}
