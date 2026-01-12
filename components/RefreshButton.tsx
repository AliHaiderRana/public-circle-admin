'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface RefreshButtonProps {
  onRefresh: () => void;
  isLoading?: boolean;
  label?: string;
}

export default function RefreshButton({ onRefresh, isLoading = false, label = "Refresh" }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(isLoading);

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
      className="flex items-center gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? 'Refreshing...' : label}
    </Button>
  );
}
