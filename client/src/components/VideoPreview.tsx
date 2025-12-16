import { Heart, MessageCircle, Send, MoreHorizontal, Music2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Video } from '@shared/schema';

interface VideoPreviewProps {
  video: Video;
}

export function VideoPreview({ video }: VideoPreviewProps) {
  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {video.url.includes('/objects/') || video.url.endsWith('.mp4') || video.url.endsWith('.webm') || video.url.endsWith('.mov') ? (
        <video 
          src={video.url}
          className="absolute h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <img 
          src={video.url} 
          alt={video.description || ''}
          className="absolute h-full w-full object-cover" 
        />
      )}

      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-20 bg-gradient-to-b from-black/40 to-transparent">
        <div className="text-white font-bold text-lg drop-shadow-md">Reels</div>
      </div>

      <div className="absolute bottom-20 right-4 flex flex-col items-center gap-5 z-20 text-white">
        <div className="flex flex-col items-center gap-0.5 w-10">
          <div className="flex items-center justify-center">
            <Heart size={28} />
          </div>
          <span className="text-xs font-medium text-center h-3.5 flex items-center">{video.likes}</span>
        </div>

        <div className="flex flex-col items-center gap-0.5 w-10">
          <div className="flex items-center justify-center">
            <MessageCircle size={28} />
          </div>
          <span className="text-xs font-medium text-center h-3.5 flex items-center">{video.comments}</span>
        </div>

        <div className="flex flex-col items-center gap-0.5 w-10">
          <div className="flex items-center justify-center">
            <Send size={28} className="-rotate-45 translate-x-1" />
          </div>
          <span className="text-xs font-medium text-center h-3.5 flex items-center">{video.shares}</span>
        </div>

        <div className="flex items-center justify-center mt-2">
          <MoreHorizontal size={28} />
        </div>

        <div className="mt-1 border-2 border-white/20 rounded-md overflow-hidden w-8 h-8">
          <img src={video.url} className="w-full h-full object-cover" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="w-8 h-8 border border-white/20">
            <AvatarImage src={video.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${video.username}`} />
            <AvatarFallback>{video.username[0]}</AvatarFallback>
          </Avatar>
          <span className="font-semibold text-sm drop-shadow-md">{video.username}</span>
          <span className="border rounded-md px-2 py-0.5 text-xs font-medium backdrop-blur-sm border-white/30 text-white">
            Follow
          </span>
        </div>

        <div className="mb-3 text-sm line-clamp-2 drop-shadow-md">
          {video.caption}
        </div>

        <div className="flex items-center gap-2 text-xs font-medium opacity-90">
          <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full backdrop-blur-sm">
            <Music2 size={12} />
            <div className="overflow-hidden w-32">
              <div className="whitespace-nowrap truncate">
                {video.song || 'Original Audio'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
        <div className="h-full bg-white/90 w-1/3" />
      </div>
    </div>
  );
}
