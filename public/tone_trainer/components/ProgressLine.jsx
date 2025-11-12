import React from "react";

export function ProgressLine({ show, percentage }) {
  if (!show) return null;

  return (
    <div
      className="absolute top-0 w-0.5 bg-white opacity-90 pointer-events-none"
      style={{
        height: "100%",
        left: `${percentage}%`,
        transition: "left 0.1s linear",
      }}
    />
  );
}
