import React, { useState } from 'react';

interface ToolCallCardProps {
  name: string;
  args: Record<string, any>;
  result?: string;
  status: 'running' | 'completed' | 'error';
  isLatest: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  tap: 'Tap',
  swipe: 'Swipe',
  input_text: 'Type text',
  get_ui_hierarchy: 'Analyze screen',
  get_screen_resolution: 'Get resolution',
};

const ToolCallCard: React.FC<ToolCallCardProps> = ({ name, args, result, status, isLatest }) => {
  const [expanded, setExpanded] = useState(false);

  const getBorderColor = () => {
    switch (status) {
      case 'running': return 'border-blue-300 bg-blue-50';
      case 'completed': return 'border-green-300 bg-green-50';
      case 'error': return 'border-red-300 bg-red-50';
    }
  };

  const formatArgs = () => {
    if (name === 'get_ui_hierarchy' || name === 'get_screen_resolution') return null;
    return Object.entries(args)
      .filter(([, val]) => val !== undefined && val !== 300)
      .map(([key, val]) => `${key}=${val}`)
      .join(', ');
  };

  return (
    <div className={`rounded-lg border px-3 py-2 my-1 text-sm ${getBorderColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-gray-800 whitespace-nowrap">
            {TOOL_LABELS[name] || name}
          </span>
          {formatArgs() && (
            <span className="text-gray-500 text-xs truncate">
              {formatArgs()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {status === 'running' && (
            <span className="flex items-center gap-1 text-blue-600 text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Executing...
            </span>
          )}
          {status === 'completed' && (
            <span className="text-green-600 text-xs">Done</span>
          )}
          {status === 'error' && (
            <span className="text-red-600 text-xs">Failed</span>
          )}
        </div>
      </div>
      {result && expanded && (
        <pre className="mt-2 text-xs text-gray-700 bg-white/80 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto">
          {(() => {
            try {
              return JSON.stringify(JSON.parse(result), null, 2);
            } catch {
              return result;
            }
          })()}
        </pre>
      )}
      {result && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-blue-600 hover:text-blue-800"
        >
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      )}
    </div>
  );
};

export default ToolCallCard;
