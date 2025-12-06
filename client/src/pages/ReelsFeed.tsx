import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { Video } from '@shared/schema';

interface FeedData {
  experimentId: string;
  experimentName: string;
  projectSettings: {
    queryKey: string;
    timeLimitSeconds: number;
    redirectUrl: string;
  };
  videos: Video[];
}

export default function ReelsFeed() {
  const [, params] = useRoute('/feed/:publicUrl');
  const publicUrl = params?.publicUrl;
  
  const [muted, setMuted] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: feedData, isLoading, error } = useQuery<FeedData>({
    queryKey: ['/api/feed', publicUrl],
    queryFn: async () => {
      if (!publicUrl) throw new Error('No feed URL');
      const res = await fetch(`/api/feed/${publicUrl}`);
      if (!res.ok) throw new Error('Feed not found');
      return res.json();
    },
    enabled: !!publicUrl,
  });

  const searchParams = new URLSearchParams(window.location.search);
  const queryKey = feedData?.projectSettings.queryKey || 'participantId';
  const participantId = searchParams.get(queryKey) || 'anonymous';
  const timeLimitSeconds = feedData?.projectSettings.timeLimitSeconds || 300;
  const redirectUrl = feedData?.projectSettings.redirectUrl || '';

  useEffect(() => {
    if (feedData?.videos?.length && !activeVideoId) {
      setActiveVideoId(feedData.videos[0].id);
    }
  }, [feedData, activeVideoId]);

  useEffect(() => {
    if (feedData && !sessionStarted) {
      setTimeRemaining(timeLimitSeconds);
      setSessionStarted(true);
    }
  }, [feedData, timeLimitSeconds, sessionStarted]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (redirectUrl) {
            const finalUrl = redirectUrl.includes('?') 
              ? `${redirectUrl}&${queryKey}=${participantId}`
              : `${redirectUrl}?${queryKey}=${participantId}`;
            window.location.href = finalUrl;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, redirectUrl, queryKey, participantId]);

  const logInteraction = useCallback(async (type: string, videoId: string, data?: any) => {
    if (!feedData?.experimentId) return;
    
    try {
      await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          experimentId: feedData.experimentId,
          videoId,
          interactionType: type,
          metadata: data,
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
      const video = feedData.videos[index];
      if (video && video.id !== activeVideoId) {
        setActiveVideoId(video.id);
        logInteraction('view_start', video.id);
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
      <div className="h-[100dvh] w-full bg-black flex items-center justify-center text-white">
        <p>No feed specified</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-[100dvh] w-full bg-black flex items-center justify-center text-white">
        <p>Loading feed...</p>
      </div>
    );
  }

  if (error || !feedData) {
    return (
      <div className="h-[100dvh] w-full bg-black flex items-center justify-center text-white">
        <p>Feed not found</p>
      </div>
    );
  }

  if (feedData.videos.length === 0) {
    return (
      <div className="h-[100dvh] w-full bg-black flex items-center justify-center text-white">
        <p>No videos in this feed</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-black flex justify-center overflow-hidden relative">
      {timeRemaining !== null && timeRemaining > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm" data-testid="timer-display">
          {formatTime(timeRemaining)}
        </div>
      )}
      
      <div 
        ref={containerRef}
        className="h-full w-full max-w-md bg-black snap-y snap-mandatory overflow-y-scroll no-scrollbar"
      >
        {feedData.videos.map((video) => (
          <div key={video.id} className="h-full w-full snap-start relative">
            <VideoPlayer 
              video={video}
              isActive={activeVideoId === video.id}
              muted={muted}
              toggleMute={() => setMuted(!muted)}
              onInteraction={(type, data) => logInteraction(type, video.id, data)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
