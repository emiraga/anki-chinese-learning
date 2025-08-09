import * as React from "react";

export interface LoadingProgressBarProps {
  stage: string;
  progressPercentage: number;
}

export const LoadingProgressBar: React.FC<LoadingProgressBarProps> = ({
  stage,
  progressPercentage,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-center mb-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-700 dark:text-gray-300">
          {stage}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
        <div
          className="bg-blue-600 h-4 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
      <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
        {progressPercentage.toFixed(1)}%
      </p>
    </div>
  );
};