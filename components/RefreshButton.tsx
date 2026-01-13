'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

interface RefreshButtonProps {
  onRefresh: () => void;
  isLoading?: boolean;
  label?: string;
}

export default function RefreshButton({ onRefresh, isLoading = false, label = "Refresh" }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(isLoading);

  // Sync with external loading state
  useEffect(() => {
    setIsRefreshing(isLoading);
  }, [isLoading]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button
      onClick={handleRefresh}
      disabled={isRefreshing}
      variant="outline"
      size="sm"
      className={`flex items-center gap-2 transition-all duration-200 ${
        isRefreshing 
          ? 'bg-primary/5 border-primary/30 text-primary' 
          : 'hover:bg-primary/5 hover:border-primary/30'
      }`}
    >
      <RefreshCw 
        className={`w-4 h-4 transition-transform duration-500 ${
          isRefreshing ? 'animate-spin text-primary' : ''
        }`} 
      />
      <span className={isRefreshing ? 'text-primary' : ''}>
        {isRefreshing ? 'Refreshing...' : label}
      </span>
      {isRefreshing && (
        <span className="flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
      )}
    </Button>
  );
}
