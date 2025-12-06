import { useState, useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { Heart, MessageCircle, Send, MoreHorizontal, Music2, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Video } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { CommentsOverlay } from './CommentsOverlay';

interface VideoPlayerProps {
  video: Video;
  isActive: boolean;
  muted: boolean;
  toggleMute: () => void;
  onInteraction: (type: string, videoId: string) => void;
}

export function VideoPlayer({ video, isActive, muted, toggleMute, onInteraction }: VideoPlayerProps) {
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Reset state when video changes or becomes inactive
  useEffect(() => {
    if (!isActive) {
      startTimeRef.current = null;
      setProgress(0);
    } else {
      startTimeRef.current = Date.now();
      // Simulate video progress
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) return 0;
          return prev + 0.5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isActive]);

  // Log viewing time on unmount or when becoming inactive
  useEffect(() => {
    return () => {
      if (startTimeRef.current) {
        const duration = Date.now() - startTimeRef.current;
        onInteraction('view_duration', `${duration}ms`);
      }
    };
  }, [isActive, onInteraction]);

  const handleDoubleTap = () => {
    if (!liked) {
      setLiked(true);
      onInteraction('like', video.id);
    }
    setShowHeartAnimation(true);
    setTimeout(() => setShowHeartAnimation(false), 1000);
  };

  const toggleLike = () => {
    if (liked) {
      setLiked(false);
      onInteraction('unlike', video.id);
    } else {
      setLiked(true);
      onInteraction('like', video.id);
    }
  };

  const handleFollow = () => {
    setFollowing(!following);
    onInteraction(following ? 'unfollow' : 'follow', video.id);
  };

  const handleShare = () => {
    onInteraction('share', video.id);
    toast({
      description: "Sent to direct messages",
      duration: 2000,
    });
  };

  const handleComment = (text: string) => {
    onInteraction('comment', video.id);
    // Increase comment count locally for feedback
  };

  return (
    <>
      <CommentsOverlay 
        video={video} 
        isOpen={showComments} 
        onOpenChange={setShowComments}
        onComment={handleComment}
      />
      <div 
        className="relative h-full w-full bg-black snap-start overflow-hidden"
        onDoubleClick={handleDoubleTap}
        data-testid={`video-container-${video.id}`}
      >
      {/* Video Content (Image for prototype) */}
      <img 
        src={video.url} 
        alt={video.description}
        className="absolute h-full w-full object-cover" 
      />

      {/* Big Heart Animation */}
      <AnimatePresence>
        {showHeartAnimation && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <Heart className="w-32 h-32 text-white fill-white drop-shadow-lg" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20 bg-gradient-to-b from-black/40 to-transparent">
        <div className="text-white font-bold text-lg drop-shadow-md">Reels</div>
        <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white/90 hover:text-white">
          {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </button>
      </div>

      {/* Right Side Actions */}
      <div className="absolute bottom-20 right-4 flex flex-col items-center gap-6 z-20 text-white">
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); toggleLike(); }}
            className={cn("transition-transform active:scale-90", liked ? "text-[#E4405F]" : "text-white")}
            data-testid={`button-like-${video.id}`}
          >
            <Heart size={28} className={cn(liked && "fill-[#E4405F]")} />
          </button>
          <span className="text-xs font-medium">{liked ? video.likes + 1 : video.likes}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
            className="transition-transform active:scale-90 text-white"
          >
            <MessageCircle size={28} />
          </button>
          <span className="text-xs font-medium">{video.comments}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); handleShare(); }}
            className="transition-transform active:scale-90 text-white"
          >
            <Send size={28} className="-rotate-45 translate-x-1" />
          </button>
          <span className="text-xs font-medium">{video.shares}</span>
        </div>

        <button className="transition-transform active:scale-90 text-white">
          <MoreHorizontal size={28} />
        </button>

        <div className="mt-2 border-2 border-white/20 rounded-md overflow-hidden w-8 h-8">
           <img src={video.url} className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Bottom Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="w-8 h-8 border border-white/20">
            <AvatarImage src={video.userAvatar} />
            <AvatarFallback>{video.username[0]}</AvatarFallback>
          </Avatar>
          <span className="font-semibold text-sm drop-shadow-md">{video.username}</span>
          <button 
            onClick={(e) => { e.stopPropagation(); handleFollow(); }}
            className={cn(
              "border rounded-md px-2 py-0.5 text-xs font-medium backdrop-blur-sm transition-colors",
              following ? "bg-white/20 border-transparent text-white" : "border-white/30 text-white hover:bg-white/10"
            )}
          >
            {following ? 'Following' : 'Follow'}
          </button>
        </div>

        <div className="mb-3 text-sm line-clamp-2 drop-shadow-md">
          {video.caption}
        </div>

        <div className="flex items-center gap-2 text-xs font-medium opacity-90">
          <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full backdrop-blur-sm">
            <Music2 size={12} />
            <div className="overflow-hidden w-32">
              <div className="animate-marquee whitespace-nowrap">
                {video.song} • Original Audio
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
        <div 
          className="h-full bg-white/90 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
    </>
  );
}
