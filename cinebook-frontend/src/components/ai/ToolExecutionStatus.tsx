import React from 'react';
import { Wrench, CheckCircle2, AlertCircle } from 'lucide-react';
import { AiToolExecution } from '../../types';

interface ToolExecutionStatusProps {
  toolCalls?: AiToolExecution[];
}

export const ToolExecutionStatus: React.FC<ToolExecutionStatusProps> = ({ toolCalls }) => {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 10px 0' }}>
      {toolCalls.map((tc, idx) => (
        <span
          key={idx}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '0.72rem',
            fontFamily: 'monospace',
            background: 'rgba(229, 9, 20, 0.12)',
            border: '1px solid rgba(229, 9, 20, 0.3)',
            color: '#f87171',
          }}
        >
          <Wrench size={11} />
          <span>{tc.toolName}</span>
          <span style={{ color: '#9ca3af', fontSize: '0.65rem' }}>
            ({tc.durationMs}ms)
          </span>
          {tc.status === 'SUCCESS' ? (
            <CheckCircle2 size={11} color="#34d399" />
          ) : (
            <AlertCircle size={11} color="#f87171" />
          )}
        </span>
      ))}
    </div>
  );
};
