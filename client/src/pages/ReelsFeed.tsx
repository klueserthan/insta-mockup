import { useState, useEffect, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { VideoPlayer } from '@/components/VideoPlayer';
import { INITIAL_VIDEOS } from '@/lib/mockData';
import { useInView } from 'react-intersection-observer';

export default function ReelsFeed() {
  // Handle participant ID logic (mock)
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const participantId = searchParams.get('participantId') || 'anonymous';
  
  const [muted, setMuted] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string>(INITIAL_VIDEOS[0].id);
  
  // Interaction Logger
  const logInteraction = (type: string, videoId: string, data?: any) => {
    console.log(`[Participant ${participantId}] Interaction:`, {
      type,
      videoId,
      timestamp: new Date().toISOString(),
      data
    });
    // In a real app, this would send to backend
  };

  // Scroll handling to detect active video
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const index = Math.round(container.scrollTop / container.clientHeight);
      const video = INITIAL_VIDEOS[index];
      if (video && video.id !== activeVideoId) {
        setActiveVideoId(video.id);
        logInteraction('view_start', video.id);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeVideoId]);

  return (
    <div className="h-[100dvh] w-full bg-black flex justify-center overflow-hidden">
      <div 
        ref={containerRef}
        className="h-full w-full max-w-md bg-black snap-y snap-mandatory overflow-y-scroll no-scrollbar"
      >
        {INITIAL_VIDEOS.map((video) => (
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
