import { useState, useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { Heart, MessageCircle, Send, MoreHorizontal, Music2, Volume2, VolumeX, Link2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Video } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { CommentsOverlay } from './CommentsOverlay';

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

interface ShareMenuProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoCaption: string;
}

function ShareMenu({ isOpen, onClose, videoUrl, videoCaption }: ShareMenuProps) {
  const { toast } = useToast();
  
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = videoCaption || 'Check out this video!';
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ description: 'Link copied to clipboard!', duration: 2000 });
      onClose();
    } catch {
      toast({ description: 'Failed to copy link', variant: 'destructive', duration: 2000 });
    }
  };
  
  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
    onClose();
  };
  
  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
    onClose();
  };
  
  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    window.open(url, '_blank');
    onClose();
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-neutral-900 rounded-t-2xl z-50 p-4 pb-8"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-lg">Share to</h3>
              <button onClick={onClose} className="text-white/60 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-4 gap-4">
              <button
                onClick={handleShareTwitter}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/10 transition-colors"
                data-testid="share-twitter"
              >
                <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center">
                  <TwitterIcon className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-xs">X</span>
              </button>
              
              <button
                onClick={handleShareFacebook}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/10 transition-colors"
                data-testid="share-facebook"
              >
                <div className="w-12 h-12 rounded-full bg-[#1877F2] flex items-center justify-center">
                  <FacebookIcon className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-xs">Facebook</span>
              </button>
              
              <button
                onClick={handleShareWhatsApp}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/10 transition-colors"
                data-testid="share-whatsapp"
              >
                <div className="w-12 h-12 rounded-full bg-[#25D366] flex items-center justify-center">
                  <WhatsAppIcon className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-xs">WhatsApp</span>
              </button>
              
              <button
                onClick={handleCopyLink}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/10 transition-colors"
                data-testid="share-copy-link"
              >
                <div className="w-12 h-12 rounded-full bg-neutral-700 flex items-center justify-center">
                  <Link2 className="w-6 h-6 text-white" />
                </div>
                <span className="text-white text-xs">Copy Link</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface VideoPlayerProps {
  video: Video;
  isActive: boolean;
  muted: boolean;
  toggleMute: () => void;
  onInteraction: (type: string, videoId: string) => void;
  showUnmutePrompt?: boolean;
}

export function VideoPlayer({ video, isActive, muted, toggleMute, onInteraction, showUnmutePrompt = false }: VideoPlayerProps) {
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasInteractedWithMute, setHasInteractedWithMute] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  
  const showMuteHighlight = showUnmutePrompt && muted && !hasInteractedWithMute;
  
  const handleMuteClick = () => {
    setHasInteractedWithMute(true);
    toggleMute();
  };

  // Control video playback based on isActive state (Instagram-like behavior)
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isActive) {
      videoElement.play().catch(() => {
        // Autoplay may be blocked by browser - that's fine
      });
    } else {
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  }, [isActive]);

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
    setShowShareMenu(true);
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
      <ShareMenu
        isOpen={showShareMenu}
        onClose={() => setShowShareMenu(false)}
        videoUrl={video.url}
        videoCaption={video.caption}
      />
      <div 
        className="relative h-full w-full bg-black snap-start overflow-hidden"
        onDoubleClick={handleDoubleTap}
        data-testid={`video-container-${video.id}`}
      >
      {/* Video Content */}
      {video.url.includes('/objects/') || video.url.endsWith('.mp4') || video.url.endsWith('.webm') || video.url.endsWith('.mov') ? (
        <video 
          ref={videoRef}
          src={video.url}
          className="absolute h-full w-full object-cover"
          loop
          muted={muted}
          playsInline
        />
      ) : (
        <img 
          src={video.url} 
          alt={video.description || ''}
          className="absolute h-full w-full object-cover" 
        />
      )}

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
        <button 
          onClick={(e) => { e.stopPropagation(); handleMuteClick(); }} 
          className={cn(
            "relative text-white/90 hover:text-white",
            showMuteHighlight && "animate-pulse-ring"
          )}
          data-testid="button-mute-toggle"
        >
          {muted ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </button>
      </div>

      {/* Right Side Actions */}
      <div className="absolute bottom-20 right-4 flex flex-col items-center gap-5 z-20 text-white">
        {/* Like */}
        <div className="flex flex-col items-center gap-0.5 w-10">
          <button 
            onClick={(e) => { e.stopPropagation(); toggleLike(); }}
            className={cn("transition-transform active:scale-90 flex items-center justify-center", liked ? "text-[#E4405F]" : "text-white")}
            data-testid={`button-like-${video.id}`}
          >
            <Heart size={28} className={cn(liked && "fill-[#E4405F]")} />
          </button>
          <span className="text-xs font-medium text-center h-3.5 flex items-center">{liked ? video.likes + 1 : video.likes}</span>
        </div>

        {/* Comments */}
        <div className="flex flex-col items-center gap-0.5 w-10">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
            className="transition-transform active:scale-90 text-white flex items-center justify-center"
          >
            <MessageCircle size={28} />
          </button>
          <span className="text-xs font-medium text-center h-3.5 flex items-center">{video.comments}</span>
        </div>

        {/* Share */}
        <div className="flex flex-col items-center gap-0.5 w-10">
          <button 
            onClick={(e) => { e.stopPropagation(); handleShare(); }}
            className="transition-transform active:scale-90 text-white flex items-center justify-center"
          >
            <Send size={28} className="-rotate-45 translate-x-1" />
          </button>
          <span className="text-xs font-medium text-center h-3.5 flex items-center">{video.shares}</span>
        </div>

        {/* More */}
        <button className="transition-transform active:scale-90 text-white flex items-center justify-center mt-2">
          <MoreHorizontal size={28} />
        </button>

        {/* Video Preview */}
        <div className="mt-1 border-2 border-white/20 rounded-md overflow-hidden w-8 h-8">
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
