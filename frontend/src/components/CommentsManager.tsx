import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Trash2, Plus, Sparkles, Loader2, MessageCircle, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient, fetchWithAuth } from '@/lib/queryClient';
import type { Video, PreseededComment } from '@/lib/api-types';

interface CommentsManagerProps {
  video: Video | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommentsManager({ video, isOpen, onOpenChange }: CommentsManagerProps) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState({ authorName: '', body: '', likes: 0 });
  const [generateCount, setGenerateCount] = useState('5');
  const [generateTone, setGenerateTone] = useState('mixed');
  const [isAddingManual, setIsAddingManual] = useState(false);

  const { data: comments = [], isLoading } = useQuery<PreseededComment[]>({
    queryKey: ['/api/videos', video?.id, 'comments'],
    queryFn: async () => {
      if (!video) return [];
      const res = await fetchWithAuth(`/api/videos/${video.id}/comments`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json();
    },
    enabled: !!video && isOpen
  });

  const createCommentMutation = useMutation({
    mutationFn: async (data: { authorName: string; body: string; likes: number }) => {
      const seed = Math.random().toString(36).substring(7);
      const res = await apiRequest('POST', `/api/videos/${video!.id}/comments`, {
        ...data,
        authorAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.authorName}_${seed}`,
        source: 'manual'
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/videos', video?.id, 'comments'] });
      setNewComment({ authorName: '', body: '', likes: 0 });
      setIsAddingManual(false);
      toast({ title: 'Comment added' });
    },
    onError: () => {
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiRequest('DELETE', `/api/comments/${commentId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/videos', video?.id, 'comments'] });
      toast({ title: 'Comment deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete comment', variant: 'destructive' });
    }
  });

  const generateCommentsMutation = useMutation({
    mutationFn: async ({ count, tone }: { count: number; tone: string }) => {
      const res = await apiRequest('POST', `/api/videos/${video!.id}/comments/generate`, { count, tone });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/videos', video?.id, 'comments'] });
      toast({ title: `Generated ${data.length} comments` });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to generate comments', description: error.message, variant: 'destructive' });
    }
  });

  const handleAddManualComment = () => {
    if (!newComment.authorName.trim() || !newComment.body.trim()) {
      toast({ title: 'Please fill in username and comment text', variant: 'destructive' });
      return;
    }
    createCommentMutation.mutate(newComment);
  };

  const handleGenerateComments = () => {
    generateCommentsMutation.mutate({ count: parseInt(generateCount), tone: generateTone });
  };

  if (!video) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle size={20} />
            Manage Comments
          </DialogTitle>
          <DialogDescription>
            Add pre-seeded comments for "{video.caption.substring(0, 50)}..."
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                AI Generation
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Number of comments</Label>
                <Select value={generateCount} onValueChange={setGenerateCount}>
                  <SelectTrigger data-testid="select-comment-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 comments</SelectItem>
                    <SelectItem value="5">5 comments</SelectItem>
                    <SelectItem value="10">10 comments</SelectItem>
                    <SelectItem value="15">15 comments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={generateTone} onValueChange={setGenerateTone}>
                  <SelectTrigger data-testid="select-comment-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mixed">Mixed (realistic)</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="negative">Negative/Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={handleGenerateComments}
              disabled={generateCommentsMutation.isPending}
              className="w-full"
              data-testid="button-generate-comments"
            >
              {generateCommentsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Comments with AI
                </>
              )}
            </Button>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Comments ({comments.length})</h4>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsAddingManual(!isAddingManual)}
                data-testid="button-add-manual-comment"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Manual
              </Button>
            </div>

            {isAddingManual && (
              <div className="p-3 border rounded-lg mb-3 space-y-3 bg-muted/30">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Username</Label>
                    <Input 
                      placeholder="user_name" 
                      value={newComment.authorName}
                      onChange={(e) => setNewComment({ ...newComment, authorName: e.target.value })}
                      data-testid="input-comment-author"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Likes</Label>
                    <Input 
                      type="number" 
                      placeholder="0" 
                      value={newComment.likes}
                      onChange={(e) => setNewComment({ ...newComment, likes: parseInt(e.target.value) || 0 })}
                      data-testid="input-comment-likes"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Comment text</Label>
                  <Input 
                    placeholder="Great video!" 
                    value={newComment.body}
                    onChange={(e) => setNewComment({ ...newComment, body: e.target.value })}
                    data-testid="input-comment-body"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setIsAddingManual(false)}>
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleAddManualComment}
                    disabled={createCommentMutation.isPending}
                    data-testid="button-save-manual-comment"
                  >
                    {createCommentMutation.isPending ? 'Adding...' : 'Add Comment'}
                  </Button>
                </div>
              </div>
            )}

            <ScrollArea className="h-[250px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No comments yet</p>
                  <p className="text-sm">Generate comments with AI or add them manually</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {comments.map((comment) => (
                    <div 
                      key={comment.id} 
                      className="flex items-start gap-3 p-3 border rounded-lg bg-background hover:bg-muted/30 transition-colors group"
                      data-testid={`comment-item-${comment.id}`}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={comment.authorAvatar} />
                        <AvatarFallback>{comment.authorName[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">@{comment.authorName}</span>
                          {comment.source === 'ai' && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">AI</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 break-words">{comment.body}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Heart size={12} />
                          <span>{comment.likes}</span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={() => deleteCommentMutation.mutate(comment.id)}
                        disabled={deleteCommentMutation.isPending}
                        data-testid={`button-delete-comment-${comment.id}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-comments">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
