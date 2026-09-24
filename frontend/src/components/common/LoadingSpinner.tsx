import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string; className?: string }> = ({
  message,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 gap-3 ${className}`}>
      <Loader2 className="w-8 h-8 animate-spin text-[#00a854]" />
      {message && <p className="text-sm text-gray-500 font-medium">{message}</p>}
    </div>
  );
};
