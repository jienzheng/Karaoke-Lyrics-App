/**
 * Real-time session synchronization hook
 * Manages session state and participant updates
 */
import { useEffect, useState, useCallback } from 'react';
import type { Session } from '@/types';

interface UseRealtimeSessionOptions {
  sessionId: string;
  onSessionUpdate?: (session: Session) => void;
  onParticipantJoined?: (userId: string) => void;
  onParticipantLeft?: (userId: string) => void;
}

export function useRealtimeSession({
  sessionId,
  onSessionUpdate,
  onParticipantJoined,
  onParticipantLeft,
}: UseRealtimeSessionOptions) {
  const [session, setSession] = useState<Session | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll session for updates
  useEffect(() => {
    if (!sessionId) return;

    let intervalId: NodeJS.Timeout;

    const fetchSession = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/queue/session/${sessionId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('access_token')}`,
            },
          }
        );

        if (response.ok) {
          const sessionData: Session = await response.json();

          // Check for changes
          if (JSON.stringify(sessionData) !== JSON.stringify(session)) {
            setSession(sessionData);
            onSessionUpdate?.(sessionData);
          }

          setError(null);
        } else if (response.status === 404) {
          setError('Session not found');
        } else {
          setError('Failed to fetch session');
        }
      } catch (err) {
        console.error('Failed to fetch session:', err);
        setError('Connection error');
      }
    };

    // Initial fetch
    fetchSession();

    // Poll every 5 seconds
    intervalId = setInterval(fetchSession, 5000);
    setIsConnected(true);

    return () => {
      clearInterval(intervalId);
      setIsConnected(false);
    };
  }, [sessionId, onSessionUpdate]);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/queue/session/${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );

      if (response.ok) {
        const sessionData: Session = await response.json();
        setSession(sessionData);
        onSessionUpdate?.(sessionData);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to refetch session:', err);
      setError('Connection error');
    }
  }, [sessionId, onSessionUpdate]);

  return {
    session,
    isConnected,
    error,
    refetch,
  };
}
