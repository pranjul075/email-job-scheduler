import React from 'react';
import { Search, SlidersHorizontal, RotateCw, X } from 'lucide-react';

export interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <header className="h-16 px-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
      <div className="flex items-center gap-3 w-full max-w-xl">
        <div className="relative flex items-center w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search emails, recipients, subjects..."
            className="w-full bg-[#f4f5f7] border border-transparent rounded-full pl-11 pr-20 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-300 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-12 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="absolute right-3.5 flex items-center gap-2 text-gray-400">
            <SlidersHorizontal className="w-3.5 h-3.5 hover:text-gray-600 cursor-pointer transition-colors" />
          </div>
        </div>

        <button
          onClick={onRefresh}
          className={`p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all ${
            isRefreshing ? 'animate-spin text-[#00a854]' : ''
          }`}
          title="Refresh emails"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
