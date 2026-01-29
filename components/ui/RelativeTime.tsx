'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface RelativeTimeProps {
  date: string | Date;
  className?: string;
}

export function RelativeTime({ date, className }: RelativeTimeProps) {
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      setTimeAgo(formatDistanceToNow(new Date(date), { addSuffix: true }));
    };

    updateTime();

    // Update every minute
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [date]);

  // Show nothing or a placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return <span className={className}>...</span>;
  }

  return <span className={className}>{timeAgo}</span>;
}
