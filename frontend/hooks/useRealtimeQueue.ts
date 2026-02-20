/**
 * Real-time queue synchronization hook
 * Listens to Supabase real-time updates for queue changes
 */
import { useEffect, useState, useCallback } from 'react';
import type { QueueItem } from '@/types';

interface UseRealtimeQueueOptions {
  sessionId: string;
  onQueueUpdate?: (queue: QueueItem[]) => void;
  onSongAdded?: (song: QueueItem) => void;
  onSongRemoved?: (songId: string) => void;
  onCurrentSongChanged?: (song: QueueItem | null) => void;
}

export function useRealtimeQueue({
  sessionId,
  onQueueUpdate,
  onSongAdded,
  onSongRemoved,
  onCurrentSongChanged,
}: UseRealtimeQueueOptions) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentSong, setCurrentSong] = useState<QueueItem | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Poll queue for updates (Supabase Realtime alternative)
  useEffect(() => {
    if (!sessionId) return;

    let intervalId: NodeJS.Timeout;

    const fetchQueue = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/queue/${sessionId}/list`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('access_token')}`,
            },
          }
        );

        if (response.ok) {
          const newQueue: QueueItem[] = await response.json();

          // Check for changes
          if (JSON.stringify(newQueue) !== JSON.stringify(queue)) {
            setQueue(newQueue);
            onQueueUpdate?.(newQueue);

            // Detect song additions (simple check - new items)
            const newSongs = newQueue.filter(
              (item) => !queue.find((q) => q.id === item.id)
            );
            newSongs.forEach((song) => onSongAdded?.(song));

            // Detect song removals
            const removedSongs = queue.filter(
              (item) => !newQueue.find((q) => q.id === item.id)
            );
            removedSongs.forEach((song) => onSongRemoved?.(song.id));
          }
        }
      } catch (error) {
        console.error('Failed to fetch queue:', error);
      }
    };

    // Initial fetch
    fetchQueue();

    // Poll every 2 seconds
    intervalId = setInterval(fetchQueue, 2000);
    setIsConnected(true);

    return () => {
      clearInterval(intervalId);
      setIsConnected(false);
    };
  }, [sessionId, onQueueUpdate, onSongAdded, onSongRemoved]);

  // Poll current song
  useEffect(() => {
    if (!sessionId) return;

    let intervalId: NodeJS.Timeout;

    const fetchCurrentSong = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/queue/${sessionId}/current`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('access_token')}`,
            },
          }
        );

        if (response.ok) {
          const song: QueueItem = await response.json();

          if (song && song.id !== currentSong?.id) {
            setCurrentSong(song);
            onCurrentSongChanged?.(song);
          }
        } else if (response.status === 404) {
          // No current song
          if (currentSong !== null) {
            setCurrentSong(null);
            onCurrentSongChanged?.(null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch current song:', error);
      }
    };

    // Initial fetch
    fetchCurrentSong();

    // Poll every 3 seconds
    intervalId = setInterval(fetchCurrentSong, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [sessionId, currentSong, onCurrentSongChanged]);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/queue/${sessionId}/list`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );

      if (response.ok) {
        const newQueue: QueueItem[] = await response.json();
        setQueue(newQueue);
        onQueueUpdate?.(newQueue);
      }
    } catch (error) {
      console.error('Failed to refetch queue:', error);
    }
  }, [sessionId, onQueueUpdate]);

  return {
    queue,
    currentSong,
    isConnected,
    refetch,
  };
}
