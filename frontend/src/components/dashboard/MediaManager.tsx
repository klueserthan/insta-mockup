
import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { 
    Trash2, Play, Pause, GripVertical, Plus, Upload, Loader2, Sparkles, CheckCircle2, 
    MoreVertical, X, Image as ImageIcon, XCircle, Share2, ExternalLink, Eye, 
    FolderOpen, Settings, ArrowLeft, Pencil, Heart, MessageCircle, Send, Lock, Unlock, Save 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Project, Experiment, Video } from '@/lib/api-types';
import { useToast } from '@/hooks/use-toast';
import { VideoPlayer } from '@/components/VideoPlayer';
import { CommentsManager } from '@/components/CommentsManager';
import { MediaEditor } from './MediaEditor';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps {
  video: Video;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
  onPreview: (id: string) => void;
  onEdit: (video: Video) => void;
  onManageComments: (video: Video) => void;
  onToggleLock: (video: Video) => void;
  lockAllPositions: boolean;
  projectId: string;
}

function SortableRow({ video, isSelected, onSelect, onDelete, onPreview, onEdit, onManageComments, onToggleLock, lockAllPositions, projectId }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id, disabled: video.isLocked || lockAllPositions });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: isDragging ? 'relative' as const : undefined,
    backgroundColor: isDragging ? 'hsl(var(--muted))' : undefined,
  };

  const isEffectivelyLocked = video.isLocked || lockAllPositions;

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} className={`${isDragging ? 'opacity-50' : ''} ${isSelected ? 'bg-muted/50' : ''} ${video.isLocked ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
      <TableCell className="w-[50px]">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(video.id, checked as boolean)}
          data-testid={`checkbox-video-${video.id}`}
        />
      </TableCell>
      <TableCell className="w-[50px]">
        <div 
          {...(isEffectivelyLocked ? {} : listeners)} 
          className={`p-2 rounded flex items-center justify-center ${isEffectivelyLocked ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing hover:bg-muted'}`}
          data-testid={`drag-handle-${video.id}`}
        >
          <GripVertical size={18} className="text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell>
        <Avatar className="h-8 w-8">
           <AvatarImage src={video.socialAccount?.avatarUrl} />
           <AvatarFallback>{video.socialAccount?.username?.substring(0,2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </TableCell>
      <TableCell className="w-[50px]">
        <Button 
          variant="ghost" 
          size="icon" 
          title={video.isLocked ? "Unlock position" : "Lock position"}
          onClick={() => onToggleLock(video)}
          disabled={lockAllPositions}
          className={video.isLocked ? "text-amber-600" : "text-muted-foreground"}
          data-testid={`button-lock-${video.id}`}
        >
          {video.isLocked ? <Lock size={16} /> : <Unlock size={16} />}
        </Button>
      </TableCell>
      <TableCell>
        <div className="w-12 h-20 rounded bg-gray-200 overflow-hidden flex items-center justify-center bg-black">
          {video.filename.endsWith('.mp4') || video.filename.endsWith('.webm') ? (
               <video src={`/media/${video.filename}`} className="w-full h-full object-cover" muted loop playsInline onMouseOver={e => e.currentTarget.play()} onMouseOut={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
          ) : (
               <img src={`/media/${video.filename}`} alt="Thumbnail" className="w-full h-full object-cover" />
          )}
        </div>
      </TableCell>
      <TableCell className="font-medium">
        <div className="max-w-[300px] truncate">{video.caption}</div>
        <div className="text-xs text-muted-foreground mt-1">@{video.socialAccount?.username}</div>
      </TableCell>
      <TableCell>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Heart size={16} strokeWidth={2} /> {(video.likes || 0).toLocaleString()}</span>
          <span className="flex items-center gap-1"><MessageCircle size={16} strokeWidth={2} className="scale-x-[-1]" /> {(video.comments || 0).toLocaleString()}</span>
          <span className="flex items-center gap-1"><Send size={16} strokeWidth={2} /> {(video.shares || 0).toLocaleString()}</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" title="Edit" onClick={() => onEdit(video)} data-testid={`button-edit-${video.id}`}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="icon" title="Manage Comments" onClick={() => onManageComments(video)} data-testid={`button-comments-${video.id}`}>
            <MessageCircle size={16} />
          </Button>
          <Button variant="ghost" size="icon" title="Preview" onClick={() => onPreview(video.id)} data-testid={`button-preview-${video.id}`}>
            <ExternalLink size={16} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" title="Remove" data-testid={`button-delete-${video.id}`}>
                <Trash2 size={16} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this media?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this media from the feed. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(video.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface MediaManagerProps {
  project: Project;
  experiment: Experiment;
  videos: Video[];
  onBack: () => void;
}

export function MediaManager({ project, experiment, videos, onBack }: MediaManagerProps) {
  const { toast } = useToast();
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [previewingVideo, setPreviewingVideo] = useState<Video | null>(null);
  const [managingCommentsVideo, setManagingCommentsVideo] = useState<Video | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [bulkCommentTone, setBulkCommentTone] = useState<string>("mixed");
  const [bulkCommentCount, setBulkCommentCount] = useState<number>(5);
  const [localVideoOrder, setLocalVideoOrder] = useState<Video[]>(videos);
  const [hasUnsavedOrder, setHasUnsavedOrder] = useState(false);

  // Sync local order when videos prop changes (e.g., after save or refresh)
  useEffect(() => {
    setLocalVideoOrder(videos);
    setHasUnsavedOrder(false);
  }, [videos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateExperimentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Experiment> }) => {
      const res = await apiRequest('PATCH', `/api/experiments/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'experiments'] });
      setEditingExperiment(null);
      toast({ title: 'Feed settings updated', description: 'Your feed settings have been saved.' });
    },
  });

  const deleteExperimentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/experiments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'experiments'] });
      onBack();
      toast({ title: 'Feed deleted' });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/videos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments', experiment.id, 'videos'] });
      toast({ title: 'Media removed' });
    },
  });

  const reorderVideosMutation = useMutation({
    mutationFn: async (orderedVideoIds: string[]) => {
      await apiRequest('POST', '/api/videos/reorder', { 
        experimentId: experiment.id,
        orderedVideoIds 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments', experiment.id, 'videos'] });
      setHasUnsavedOrder(false);
      toast({ title: 'Order saved', description: 'Media order has been updated.' });
    },
  });

  const updateVideoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Video> }) => {
      const res = await apiRequest('PATCH', `/api/videos/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments', experiment.id, 'videos'] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      await apiRequest('POST', '/api/videos/bulk-delete', { videoIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments', experiment.id, 'videos'] });
      setSelectedVideoIds(new Set());
      toast({ title: 'Media deleted', description: `${selectedVideoIds.size} media item(s) removed from the feed.` });
    },
  });

  const bulkGenerateCommentsMutation = useMutation({
    mutationFn: async ({ videoIds, count, tone }: { videoIds: string[]; count: number; tone: string }) => {
      const res = await apiRequest('POST', '/api/videos/bulk-generate-comments', { videoIds, count, tone });
      return res.json();
    },
    onSuccess: () => {
      setSelectedVideoIds(new Set());
      toast({ title: 'Comments generated', description: `AI comments added to ${selectedVideoIds.size} media item(s).` });
    },
  });

  const handleVideoSelect = (videoId: string, checked: boolean) => {
    setSelectedVideoIds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(videoId);
      } else {
        newSet.delete(videoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVideoIds(new Set(localVideoOrder.map(v => v.id)));
    } else {
      setSelectedVideoIds(new Set());
    }
  };

  const handleAddNewVideo = () => {
    setEditingVideo({
      id: '',
      filename: '',
      socialAccountId: '',
      caption: '',
      likes: 0,
      comments: 0,
      shares: 0,
      song: '',
      description: undefined,
      position: localVideoOrder.length,
      experimentId: experiment.id,
      createdAt: new Date().toISOString(),
    } as Video);
  };

  const copyPublicLink = () => {
    const url = `${window.location.origin}/feed/${experiment.publicUrl}?${project.queryKey}=YOUR_PARTICIPANT_ID`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied!', description: 'Public experiment URL copied to clipboard.' });
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = localVideoOrder.findIndex((v) => v.id === active.id);
      const newIndex = localVideoOrder.findIndex((v) => v.id === over.id);
      const reordered = arrayMove(localVideoOrder, oldIndex, newIndex);
      setLocalVideoOrder(reordered);
      setHasUnsavedOrder(true);
    }
  }

  const handleSaveOrder = () => {
    const orderedVideoIds = localVideoOrder.map((v) => v.id);
    reorderVideosMutation.mutate(orderedVideoIds);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-feeds">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{experiment.name}</h2>
          <p className="text-muted-foreground text-sm">{project.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.open(`/feed/${experiment.publicUrl}?${project.queryKey}=preview`, '_blank')} className="gap-2" data-testid="button-preview-feed">
            <Eye size={16} /> Preview
          </Button>
          <Button variant="outline" onClick={copyPublicLink} className="gap-2" data-testid="button-copy-link">
            <Share2 size={16} /> Copy Link
          </Button>
          <Dialog open={!!editingExperiment} onOpenChange={(open) => !open && setEditingExperiment(null)}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" onClick={() => setEditingExperiment(experiment)} data-testid="button-feed-settings">
                <Settings size={16} />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Feed Settings</DialogTitle>
                <DialogDescription>Configure settings for this feed.</DialogDescription>
              </DialogHeader>
              {editingExperiment && (
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Feed Name</Label>
                    <Input 
                      value={editingExperiment.name} 
                      onChange={(e) => setEditingExperiment({ ...editingExperiment, name: e.target.value })} 
                      data-testid="input-feed-name-edit"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <Label htmlFor="is-active">Feed Active (Kill Switch)</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        When disabled, participants cannot access this feed and will see a friendly message that the study is not active.
                      </p>
                    </div>
                    <Switch
                      id="is-active"
                      checked={editingExperiment.isActive ?? true}
                      onCheckedChange={(checked) => setEditingExperiment({ ...editingExperiment, isActive: checked })}
                      data-testid="switch-is-active"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <Label htmlFor="persist-timer">Persist Timer Across Reloads</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        When enabled, the timer continues from where it left off if a participant refreshes the page. If time has expired, they will be redirected immediately.
                      </p>
                    </div>
                    <Switch
                      id="persist-timer"
                      checked={editingExperiment.persistTimer || false}
                      onCheckedChange={(checked) => setEditingExperiment({ ...editingExperiment, persistTimer: checked })}
                      data-testid="switch-persist-timer"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <Label htmlFor="unmute-prompt">Show Unmute Prompt</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        When enabled, a pulsing highlight appears around the mute button to prompt participants to enable audio.
                      </p>
                    </div>
                    <Switch
                      id="unmute-prompt"
                      checked={editingExperiment.showUnmutePrompt || false}
                      onCheckedChange={(checked) => setEditingExperiment({ ...editingExperiment, showUnmutePrompt: checked })}
                      data-testid="switch-unmute-prompt"
                    />
                  </div>
                </div>
              )}
              <DialogFooter className="flex justify-between">
                <Button 
                  variant="destructive" 
                  onClick={() => { 
                    deleteExperimentMutation.mutate(editingExperiment!.id); 
                    setEditingExperiment(null); 
                  }}
                  data-testid="button-delete-feed"
                >
                  Delete Feed
                </Button>
                <Button 
                  onClick={() => updateExperimentMutation.mutate({ 
                    id: editingExperiment!.id, 
                    data: { 
                      name: editingExperiment!.name,
                      persistTimer: editingExperiment!.persistTimer,
                      showUnmutePrompt: editingExperiment!.showUnmutePrompt,
                      isActive: editingExperiment!.isActive
                    } 
                  })}
                  disabled={updateExperimentMutation.isPending}
                  data-testid="button-save-feed-settings"
                >
                  {updateExperimentMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Feed Media</CardTitle>
            <CardDescription>
              Manage the media visible to participants. Drag to reorder, then click Save Order.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hasUnsavedOrder && (
              <Button 
                onClick={handleSaveOrder} 
                className="gap-2" 
                variant="default"
                disabled={reorderVideosMutation.isPending}
                data-testid="button-save-order"
              >
                {reorderVideosMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save Order
              </Button>
            )}
            <Button onClick={handleAddNewVideo} className="gap-2 bg-[#E4405F] hover:bg-[#D03050] text-white border-0" data-testid="button-add-video">
              <Plus size={16} /> Add Media
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No media in this feed yet.</p>
              <p className="text-sm mt-1">Add media via the API or upload interface.</p>
            </div>
          ) : (
            <>
            {selectedVideoIds.size > 0 && (
              <div className="mb-4 p-4 bg-muted rounded-lg flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedVideoIds.size} media item(s) selected</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedVideoIds(new Set())} data-testid="button-clear-selection">
                    <X size={14} className="mr-1" /> Clear
                  </Button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Select value={bulkCommentTone} onValueChange={setBulkCommentTone}>
                      <SelectTrigger className="w-[120px]" data-testid="select-bulk-tone">
                        <SelectValue placeholder="Tone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="positive">Positive</SelectItem>
                        <SelectItem value="negative">Negative</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={bulkCommentCount.toString()} onValueChange={(v) => setBulkCommentCount(parseInt(v))}>
                      <SelectTrigger className="w-[80px]" data-testid="select-bulk-count">
                        <SelectValue placeholder="Count" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="15">15</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="secondary" 
                      onClick={() => bulkGenerateCommentsMutation.mutate({ 
                        videoIds: Array.from(selectedVideoIds), 
                        count: bulkCommentCount, 
                        tone: bulkCommentTone 
                      })}
                      disabled={bulkGenerateCommentsMutation.isPending}
                      data-testid="button-bulk-generate-comments"
                    >
                      {bulkGenerateCommentsMutation.isPending ? (
                        <Loader2 size={16} className="mr-2 animate-spin" />
                      ) : (
                        <Sparkles size={16} className="mr-2" />
                      )}
                      Generate Comments
                    </Button>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" data-testid="button-bulk-delete">
                        <Trash2 size={16} className="mr-2" /> Delete Selected
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedVideoIds.size} media item(s)?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove the selected media from the feed. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => bulkDeleteMutation.mutate(Array.from(selectedVideoIds))} 
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          data-testid="button-confirm-bulk-delete"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={localVideoOrder.length > 0 && selectedVideoIds.size === localVideoOrder.length}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="w-[50px]">Author</TableHead>
                    <TableHead className="w-[50px]">Lock</TableHead>
                    <TableHead className="w-[100px]">Thumbnail</TableHead>
                    <TableHead>Caption</TableHead>
                    <TableHead>Metrics</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext items={localVideoOrder} strategy={verticalListSortingStrategy}>
                    {localVideoOrder.map((video) => (
                      <SortableRow 
                        key={video.id} 
                        video={video}
                        isSelected={selectedVideoIds.has(video.id)}
                        onSelect={handleVideoSelect}
                        onDelete={(id) => deleteVideoMutation.mutate(id)}
                        onPreview={(id) => setPreviewingVideo(localVideoOrder.find(v => v.id === id) || null)}
                        onEdit={(v) => { setEditingVideo(v); }}
                        onManageComments={(v) => setManagingCommentsVideo(v)}
                        onToggleLock={(v) => updateVideoMutation.mutate({ id: v.id, data: { isLocked: !v.isLocked } })}
                        lockAllPositions={project.lockAllPositions || false}
                        projectId={project.id}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
            </>
          )}
        </CardContent>
      </Card>

      {editingVideo && (
        <MediaEditor
          open={!!editingVideo}
          onOpenChange={(open) => !open && setEditingVideo(null)}
          video={editingVideo}
          experimentId={experiment.id}
          projectId={project.id}
        />
      )}

      <Dialog open={!!previewingVideo} onOpenChange={(open) => !open && setPreviewingVideo(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-0" data-testid="dialog-video-preview">
          <DialogHeader className="sr-only">
            <DialogTitle>Video Preview</DialogTitle>
            <DialogDescription>Preview of how this video will appear in the feed</DialogDescription>
          </DialogHeader>
          <div className="aspect-[9/16] max-h-[80vh]">
            {previewingVideo && (
              <VideoPlayer video={previewingVideo} previewMode />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CommentsManager
        video={managingCommentsVideo}
        isOpen={!!managingCommentsVideo}
        onOpenChange={(open) => !open && setManagingCommentsVideo(null)}
      />
    </div>
  );
}
