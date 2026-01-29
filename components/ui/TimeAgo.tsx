'use client';

import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';

interface TimeAgoProps {
    date: string | Date;
    className?: string;
    addSuffix?: boolean;
}

export function TimeAgo({ date, className, addSuffix = true }: TimeAgoProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <span className={className}>...</span>;
    }

    return (
        <span className={className}>
            {formatDistanceToNow(new Date(date), { addSuffix })}
        </span>
    );
}
