export function removeDuplicateChars(
  str: string,
  ignore: Set<string> | null = null
): string {
  if (ignore === null) {
    return [...new Set(str)].join("");
  }
  return [...new Set(str)].filter((c) => !ignore.has(c)).join("");
}

export function pickRandomElements<T>(arr: T[], numElements: number): T[] {
  const result: T[] = [];
  const len = arr.length;
  const taken = new Array(len);

  if (numElements > len) {
    throw new RangeError(
      "pickRandomElements: more elements taken than available"
    );
  }

  while (result.length < numElements) {
    const x = Math.floor(Math.random() * len);
    if (!taken[x]) {
      result.push(arr[x]);
      taken[x] = true;
    }
  }
  return result;
}
