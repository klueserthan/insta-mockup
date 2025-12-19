import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Send } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import type { Video, PreseededComment } from '@/lib/api-types';

interface Comment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  likes: number;
  timestamp: string;
}

interface VideoWithComments extends Video {
  preseededComments?: PreseededComment[];
}

interface CommentsOverlayProps {
  video: VideoWithComments;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onComment: (text: string) => void;
}

export function CommentsOverlay({ video, isOpen, onOpenChange, onComment }: CommentsOverlayProps) {
  const [newComment, setNewComment] = useState('');
  const [userComments, setUserComments] = useState<Comment[]>([]);

  const preseededComments: Comment[] = (video.preseededComments || []).map((c) => ({
    id: c.id,
    username: c.authorName,
    avatar: c.authorAvatar,
    text: c.body,
    likes: c.likes || 0,
    timestamp: getRelativeTime(c.createdAt || new Date().toISOString())
  }));

  const allComments = [...userComments, ...preseededComments];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      username: 'you',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=you',
      text: newComment,
      likes: 0,
      timestamp: 'now'
    };

    setUserComments([comment, ...userComments]);
    onComment(newComment);
    setNewComment('');
  };

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[75vh] bg-white dark:bg-neutral-900 rounded-t-[20px]">
        <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-gray-300/50 mb-2" />
        
        <DrawerHeader className="border-b border-gray-100 dark:border-neutral-800 pb-4">
          <DrawerTitle className="text-center text-sm font-semibold">Comments</DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6 pb-4">
            <div className="flex gap-3">
              <Avatar className="w-8 h-8 border border-gray-100">
                <AvatarImage src={video.userAvatar} />
                <AvatarFallback>{video.username[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="text-sm">
                  <span className="font-semibold mr-2">{video.username}</span>
                  {video.caption}
                </div>
                <div className="text-xs text-muted-foreground">2d</div>
              </div>
            </div>

            <div className="h-px bg-gray-100 dark:bg-neutral-800 my-2" />

            {allComments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No comments yet. Be the first to comment!
              </div>
            ) : (
              allComments.map((comment) => (
                <div key={comment.id} className="flex gap-3 group" data-testid={`feed-comment-${comment.id}`}>
                  <Avatar className="w-8 h-8 border border-gray-100">
                    <AvatarImage src={comment.avatar} />
                    <AvatarFallback>{comment.username[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="text-sm">
                      <span className="font-semibold mr-2 text-gray-900 dark:text-gray-100">{comment.username}</span>
                      <span className="text-gray-800 dark:text-gray-200">{comment.text}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{comment.timestamp}</span>
                      <button className="font-semibold hover:text-gray-500">Reply</button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <button className="text-gray-400 hover:text-red-500 transition-colors">
                      <Heart size={14} />
                    </button>
                    {comment.likes > 0 && (
                      <span className="text-[10px] text-muted-foreground">{comment.likes}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=you" />
              <AvatarFallback>ME</AvatarFallback>
            </Avatar>
            <div className="flex-1 relative">
              <Input 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..." 
                className="pr-10 bg-gray-100 dark:bg-neutral-800 border-0 focus-visible:ring-0 focus-visible:bg-gray-50 transition-colors h-11 rounded-full"
                data-testid="input-feed-comment"
              />
              {newComment.trim() && (
                <button 
                  type="submit" 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0095F6] font-semibold text-sm hover:opacity-70 transition-opacity"
                  data-testid="button-post-comment"
                >
                  Post
                </button>
              )}
            </div>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function getRelativeTime(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) return 'now';
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  return `${Math.floor(diffDays / 30)}mo`;
}
