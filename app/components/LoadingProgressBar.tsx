import * as React from "react";

export interface LoadingProgressBarProps {
  stage: string;
  progressPercentage: number;
  stageConfig?: Record<string, { start: number; end: number }>;
}

export const LoadingProgressBar: React.FC<LoadingProgressBarProps> = ({
  stage,
  progressPercentage,
  stageConfig,
}) => {
  // Calculate continuous progress percentage
  const continuousProgress = React.useMemo(() => {
    if (!stageConfig || !stage) return progressPercentage;
    
    const config = stageConfig[stage];
    if (!config) return progressPercentage;
    
    const stageRange = config.end - config.start;
    const stageProgress = (progressPercentage / 100) * stageRange;
    return config.start + stageProgress;
  }, [stage, progressPercentage, stageConfig]);

  const displayProgress = stageConfig ? continuousProgress : progressPercentage;
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
          style={{ width: `${displayProgress}%` }}
        ></div>
      </div>
      <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
        {displayProgress.toFixed(1)}%
      </p>
    </div>
  );
};