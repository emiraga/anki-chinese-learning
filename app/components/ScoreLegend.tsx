export function ScoreLegend() {
  return (
    <div className="text-sm text-gray-500 dark:text-gray-400">
      Score:{" "}
      <span className="text-green-600 dark:text-green-400 font-semibold">
        ≥8 = Excellent
      </span>
      ,
      <span className="text-yellow-600 dark:text-yellow-400 font-semibold ml-2">
        ≥6 = Good
      </span>
      ,
      <span className="text-red-600 dark:text-red-400 font-semibold ml-2">
        &lt;6 = Poor
      </span>
    </div>
  );
}
