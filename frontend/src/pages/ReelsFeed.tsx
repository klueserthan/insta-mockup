import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ArrowLeft } from 'lucide-react';
import type { Video } from '@/lib/api-types';

interface FeedData {
  experimentId: string;
  experimentName: string;
  persistTimer: boolean;
  showUnmutePrompt: boolean;
  projectSettings: {
    queryKey: string;
    timeLimitSeconds: number;
    redirectUrl: string;
    endScreenMessage: string;
  };
  videos: Video[];
}

export default function ReelsFeed() {
  const [, params] = useRoute('/feed/:publicUrl');
  const [, setLocation] = useLocation();
  const publicUrl = params?.publicUrl;
  
  const [muted, setMuted] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Use -1 as a sentinel for "no previous video index" / "not yet initialized".
  const lastVideoIndexRef = useRef<number>(-1);

  const { data: feedData, isLoading, error } = useQuery<FeedData>({
    queryKey: ['/api/feed', publicUrl, window.location.search],
    queryFn: async () => {
      if (!publicUrl) throw new Error('No feed URL');
      // Forward query parameters to the API for participant-specific randomization
      const queryString = window.location.search;
      const res = await fetch(`/api/feed/${publicUrl}${queryString}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.detail || 'Feed not found';
        throw new Error(errorMessage);
      }
      return res.json();
    },
    enabled: !!publicUrl,
  });

  const searchParams = new URLSearchParams(window.location.search);
  const queryKey = feedData?.projectSettings.queryKey || 'participantId';
  const participantId = searchParams.get(queryKey) || 'anonymous';
  const isPreviewMode = participantId === 'preview';
  const timeLimitSeconds = feedData?.projectSettings.timeLimitSeconds || 300;
  const redirectUrl = feedData?.projectSettings.redirectUrl || '';
  const endScreenMessage = feedData?.projectSettings.endScreenMessage || 'Thank you for participating in this study.';

  const navigateToEndScreen = useCallback(() => {
    // Never redirect in preview mode
    if (isPreviewMode) return;
    
    // Preserve original query string for forwarding to redirect URL (US4)
    const originalQueryString = window.location.search;
    
    // Create end screen params with internal configuration
    const endScreenParams = new URLSearchParams();
    endScreenParams.set('message', endScreenMessage);
    endScreenParams.set('redirect', redirectUrl);
    endScreenParams.set('queryKey', queryKey);
    
    // Store original query string to forward to redirect URL
    // Check length after substring to avoid setting empty _originalParams
    const paramsToForward = originalQueryString.substring(1);
    if (paramsToForward) {
      endScreenParams.set('_originalParams', paramsToForward);
    }
    
    setLocation(`/end/${publicUrl}?${endScreenParams.toString()}`);
  }, [endScreenMessage, redirectUrl, queryKey, publicUrl, setLocation, isPreviewMode]);

  useEffect(() => {
    // feedData?.videos?.length checks both existence and non-zero length,
    // ensuring feedData.videos[0] is safe to access
    if (feedData?.videos?.length && !activeVideoId) {
      setActiveVideoId(feedData.videos[0].id);
      lastVideoIndexRef.current = 0; // Initialize with first video index
    }
  }, [feedData, activeVideoId]);

  useEffect(() => {
    if (feedData && !sessionStarted) {
      // Skip timer logic in preview mode
      if (isPreviewMode) {
        setTimeRemaining(timeLimitSeconds);
        setSessionStarted(true);
        return;
      }

      const persistTimer = feedData.persistTimer;
      const storageKey = `timer_${feedData.experimentId}_${participantId}`;
      
      if (persistTimer) {
        const storedData = localStorage.getItem(storageKey);
        
        if (storedData) {
          try {
            const { startTime } = JSON.parse(storedData);
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const remaining = timeLimitSeconds - elapsedSeconds;
            
            if (remaining <= 0) {
              navigateToEndScreen();
              setTimeRemaining(0);
            } else {
              setTimeRemaining(remaining);
            }
          } catch (e) {
            localStorage.setItem(storageKey, JSON.stringify({ startTime: Date.now() }));
            setTimeRemaining(timeLimitSeconds);
          }
        } else {
          localStorage.setItem(storageKey, JSON.stringify({ startTime: Date.now() }));
          setTimeRemaining(timeLimitSeconds);
        }
      } else {
        setTimeRemaining(timeLimitSeconds);
      }
      
      setSessionStarted(true);
    }
  }, [feedData, timeLimitSeconds, sessionStarted, participantId, navigateToEndScreen, isPreviewMode]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;
    // Don't run countdown timer in preview mode
    if (isPreviewMode) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (feedData?.experimentId && feedData?.persistTimer) {
            const storageKey = `timer_${feedData.experimentId}_${participantId}`;
            localStorage.removeItem(storageKey);
          }
          navigateToEndScreen();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, navigateToEndScreen, feedData?.experimentId, feedData?.persistTimer, participantId, isPreviewMode]);

  const logInteraction = useCallback(async (type: string, videoId: string, data?: any, options?: { keepalive?: boolean }) => {
    if (!feedData?.experimentId) return;
    
    // Heartbeat Logic
    if (type === 'heartbeat') {
       try {
         await fetch('/api/interactions/heartbeat', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           keepalive: options?.keepalive,
           body: JSON.stringify({
             sessionId: data.sessionId,
             participantId,
             videoId,
             durationMs: data.durationMs
           })
         });
       } catch (err) {
         console.error('Failed to send heartbeat:', err);
       }
       return;
    }

    try {
      await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          experimentId: feedData.experimentId,
          videoId,
          interactionType: type,
          interactionData: data, // Note: backend model expects interaction_data or alias metadata
        }),
      });
    } catch (err) {
      console.error('Failed to log interaction:', err);
    }
  }, [feedData?.experimentId, participantId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !feedData?.videos?.length) return;

    const handleScroll = () => {
      const index = Math.round(container.scrollTop / container.clientHeight);
      const newVideo = feedData.videos[index];
      if (newVideo && newVideo.id !== activeVideoId) {
        // Log navigation direction (FR-011 requirement)
        const previousIndex = lastVideoIndexRef.current;
        const previousVideo =
          previousIndex >= 0 && previousIndex < feedData.videos.length
            ? feedData.videos[previousIndex]
            : undefined;

        if (previousVideo && previousIndex !== index) {
          const direction = index > previousIndex ? 'next' : 'previous';
          // Log navigation as movement FROM the previous video TO the new video
          logInteraction(direction, newVideo.id, {
            fromVideoId: previousVideo.id,
            toVideoId: newVideo.id,
          });
        }

        setActiveVideoId(newVideo.id);
        logInteraction('view_start', newVideo.id);
        lastVideoIndexRef.current = index;
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeVideoId, feedData?.videos, logInteraction]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!publicUrl) {
    return (
      <div className="h-[100dvh] w-full bg-white flex items-center justify-center text-black">
        <p>No feed specified</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-[100dvh] w-full bg-white flex items-center justify-center text-black">
        <p>Loading feed...</p>
      </div>
    );
  }

  if (error || !feedData) {
    return (
      <div className="h-[100dvh] w-full bg-white flex items-center justify-center text-black">
        <p>{error?.message || 'Feed not found'}</p>
      </div>
    );
  }

  if (feedData.videos.length === 0) {
    return (
      <div className="h-[100dvh] w-full bg-white flex items-center justify-center text-black">
        <p>No videos in this feed</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-white flex justify-center overflow-hidden relative">
      <button
        onClick={() => setLocation('/dashboard')}
        className="absolute top-4 left-4 z-50 bg-black/60 text-white p-2 rounded-full backdrop-blur-sm hover:bg-black/80 transition-colors"
        data-testid="button-back-dashboard"
        title="Back to Dashboard"
      >
        <ArrowLeft size={20} />
      </button>
      
      {timeRemaining !== null && timeRemaining > 0 && (
        <div className="absolute top-11 left-1/2 -translate-x-1/2 z-50 bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm" data-testid="timer-display">
          {formatTime(timeRemaining)}
        </div>
      )}
      
      <div 
        ref={containerRef}
        className="h-full w-full bg-white snap-y snap-mandatory overflow-y-scroll no-scrollbar flex flex-col items-center"
      >
        {feedData.videos.map((video) => (
          <div key={video.id} className="h-full snap-end shrink-0 pt-5" style={{ aspectRatio: '9/16' }}>
            <VideoPlayer 
              video={video}
              isActive={activeVideoId === video.id}
              muted={muted}
              toggleMute={() => setMuted(!muted)}
              onInteraction={logInteraction}
              showUnmutePrompt={feedData.showUnmutePrompt}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
