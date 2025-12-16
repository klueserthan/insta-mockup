import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Share2, BarChart3, ExternalLink, Trash2, Eye, GripVertical, FolderOpen, Settings, ArrowLeft, Pencil, Upload, CheckCircle2, Loader2, MessageCircle, Sparkles, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ObjectUploader } from '@/components/ObjectUploader';
import { VideoPlayer } from '@/components/VideoPlayer';
import { CommentsManager } from '@/components/CommentsManager';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient, fetchWithAuth } from '@/lib/queryClient';
import type { Project, Experiment, Video } from '@shared/schema';
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
}

function SortableRow({ video, isSelected, onSelect, onDelete, onPreview, onEdit, onManageComments }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: isDragging ? 'relative' as const : undefined,
    backgroundColor: isDragging ? 'hsl(var(--muted))' : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} className={`${isDragging ? 'opacity-50' : ''} ${isSelected ? 'bg-muted/50' : ''}`}>
      <TableCell className="w-[50px]">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(video.id, checked as boolean)}
          data-testid={`checkbox-video-${video.id}`}
        />
      </TableCell>
      <TableCell className="w-[50px]">
        <div 
          {...listeners} 
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded flex items-center justify-center"
          data-testid={`drag-handle-${video.id}`}
        >
          <GripVertical size={18} className="text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell>
        <div className="w-12 h-20 rounded bg-gray-200 overflow-hidden">
          <img src={video.url} alt="Thumbnail" className="w-full h-full object-cover" />
        </div>
      </TableCell>
      <TableCell className="font-medium">
        <div className="max-w-[300px] truncate">{video.caption}</div>
        <div className="text-xs text-muted-foreground mt-1">@{video.username}</div>
      </TableCell>
      <TableCell>
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span>❤️ {video.likes.toLocaleString()}</span>
          <span>💬 {video.comments.toLocaleString()}</span>
          <span>↗️ {video.shares.toLocaleString()}</span>
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
                <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this video from the feed. This action cannot be undone.
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

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, logoutMutation } = useAuth();
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [experimentDialogOpen, setExperimentDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  const [newProject, setNewProject] = useState({ name: '', queryKey: 'participantId', timeLimitSeconds: 300, redirectUrl: '', endScreenMessage: 'Thank you for participating in this study. You will be redirected shortly.' });
  const [newExperiment, setNewExperiment] = useState({ name: '' });
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'finalizing' | 'done'>('idle');
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null);
  const [previewingVideo, setPreviewingVideo] = useState<Video | null>(null);
  const [managingCommentsVideo, setManagingCommentsVideo] = useState<Video | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [bulkCommentTone, setBulkCommentTone] = useState<string>("mixed");
  const [bulkCommentCount, setBulkCommentCount] = useState<number>(5);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  const { data: experiments = [] } = useQuery<Experiment[]>({
    queryKey: ['/api/projects', selectedProjectId, 'experiments'],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetchWithAuth(`/api/projects/${selectedProjectId}/experiments`);
      if (!res.ok) throw new Error('Failed to fetch experiments');
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: videos = [] } = useQuery<Video[]>({
    queryKey: ['/api/experiments', selectedExperimentId, 'videos'],
    queryFn: async () => {
      if (!selectedExperimentId) return [];
      const res = await fetchWithAuth(`/api/experiments/${selectedExperimentId}/videos`);
      if (!res.ok) throw new Error('Failed to fetch videos');
      return res.json();
    },
    enabled: !!selectedExperimentId,
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedExperiment = experiments.find(e => e.id === selectedExperimentId);

  const createProjectMutation = useMutation({
    mutationFn: async (data: typeof newProject) => {
      const res = await apiRequest('POST', '/api/projects', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setProjectDialogOpen(false);
      setNewProject({ name: '', queryKey: 'participantId', timeLimitSeconds: 300, redirectUrl: '', endScreenMessage: 'Thank you for participating in this study. You will be redirected shortly.' });
      toast({ title: 'Project created', description: 'Your new project is ready.' });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof newProject> }) => {
      const res = await apiRequest('PATCH', `/api/projects/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setEditingProject(null);
      toast({ title: 'Project updated', description: 'Settings saved successfully.' });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setSelectedProjectId(null);
      setSelectedExperimentId(null);
      toast({ title: 'Project deleted' });
    },
  });

  const createExperimentMutation = useMutation({
    mutationFn: async (data: typeof newExperiment) => {
      const res = await apiRequest('POST', `/api/projects/${selectedProjectId}/experiments`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProjectId, 'experiments'] });
      setExperimentDialogOpen(false);
      setNewExperiment({ name: '' });
      toast({ title: 'Feed created', description: 'Your new feed is ready.' });
    },
  });

  const updateExperimentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Experiment> }) => {
      const res = await apiRequest('PATCH', `/api/experiments/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProjectId, 'experiments'] });
      setEditingExperiment(null);
      toast({ title: 'Feed settings updated', description: 'Your feed settings have been saved.' });
    },
  });

  const deleteExperimentMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/experiments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProjectId, 'experiments'] });
      setSelectedExperimentId(null);
      toast({ title: 'Feed deleted' });
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/videos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments', selectedExperimentId, 'videos'] });
      toast({ title: 'Video removed' });
    },
  });

  const reorderVideosMutation = useMutation({
    mutationFn: async (updates: { id: string; position: number }[]) => {
      await apiRequest('POST', '/api/videos/reorder', { updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments', selectedExperimentId, 'videos'] });
    },
  });

  const updateVideoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Video> }) => {
      const res = await apiRequest('PATCH', `/api/videos/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments', selectedExperimentId, 'videos'] });
      setEditingVideo(null);
      toast({ title: 'Video updated', description: 'Video details saved successfully.' });
    },
  });

  const createVideoMutation = useMutation({
    mutationFn: async (data: { url: string; username: string; userAvatar: string; caption: string; likes: number; comments: number; shares: number }) => {
      const res = await apiRequest('POST', `/api/experiments/${selectedExperimentId}/videos`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments', selectedExperimentId, 'videos'] });
      setEditingVideo(null);
      toast({ title: 'Video added', description: 'New video added to the feed.' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (videoIds: string[]) => {
      await apiRequest('POST', '/api/videos/bulk-delete', { videoIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments', selectedExperimentId, 'videos'] });
      setSelectedVideoIds(new Set());
      toast({ title: 'Videos deleted', description: `${selectedVideoIds.size} video(s) removed from the feed.` });
    },
  });

  const bulkGenerateCommentsMutation = useMutation({
    mutationFn: async ({ videoIds, count, tone }: { videoIds: string[]; count: number; tone: string }) => {
      const res = await apiRequest('POST', '/api/videos/bulk-generate-comments', { videoIds, count, tone });
      return res.json();
    },
    onSuccess: () => {
      setSelectedVideoIds(new Set());
      toast({ title: 'Comments generated', description: `AI comments added to ${selectedVideoIds.size} video(s).` });
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
      setSelectedVideoIds(new Set(videos.map(v => v.id)));
    } else {
      setSelectedVideoIds(new Set());
    }
  };

  const isNewVideo = editingVideo && !editingVideo.id;

  const handleAddNewVideo = () => {
    setUploadStatus('idle');
    setEditingVideo({
      id: '',
      url: '',
      username: '',
      caption: '',
      likes: 0,
      comments: 0,
      shares: 0,
      song: '',
      userAvatar: '',
      description: null,
      position: videos.length,
      experimentId: selectedExperimentId || '',
      createdAt: new Date(),
    } as Video);
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = videos.findIndex((v) => v.id === active.id);
      const newIndex = videos.findIndex((v) => v.id === over.id);
      const reordered = arrayMove(videos, oldIndex, newIndex);
      const updates = reordered.map((v, i) => ({ id: v.id, position: i }));
      reorderVideosMutation.mutate(updates);
    }
  }

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => setLocation('/'),
    });
  };

  const copyPublicLink = () => {
    if (!selectedExperiment || !selectedProject) return;
    const url = `${window.location.origin}/feed/${selectedExperiment.publicUrl}?${selectedProject.queryKey}=YOUR_PARTICIPANT_ID`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied!', description: 'Public experiment URL copied to clipboard.' });
  };

  if (projectsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 font-sans">
      <header className="bg-white dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-[#E4405F] to-[#833AB4] text-white p-1.5 rounded-lg">
              <BarChart3 size={20} />
            </div>
            <h1 className="font-bold text-xl tracking-tight">InstaReel Research</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground hidden md:block">
              Logged in as <span className="font-medium text-foreground">{user?.name}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">Logout</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!selectedProjectId ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold tracking-tight">Your Projects</h2>
              <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-[#E4405F] hover:bg-[#D03050] text-white border-0" data-testid="button-new-project">
                    <Plus size={16} /> New Project
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                      Projects group your feeds and define participant settings.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="project-name">Project Name</Label>
                      <Input id="project-name" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} placeholder="e.g., Study 1 - Social Media Effects" data-testid="input-project-name" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="query-key">Query String Key</Label>
                      <Input id="query-key" value={newProject.queryKey} onChange={(e) => setNewProject({ ...newProject, queryKey: e.target.value })} placeholder="e.g., participantId, prolificId" data-testid="input-query-key" />
                      <p className="text-xs text-muted-foreground">The URL parameter to capture from participant links</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="time-limit">Time Limit (seconds)</Label>
                      <Input id="time-limit" type="number" value={newProject.timeLimitSeconds} onChange={(e) => setNewProject({ ...newProject, timeLimitSeconds: parseInt(e.target.value) || 300 })} data-testid="input-time-limit" />
                      <p className="text-xs text-muted-foreground">How long participants can view the feed</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="redirect-url">Redirect URL</Label>
                      <Input id="redirect-url" value={newProject.redirectUrl} onChange={(e) => setNewProject({ ...newProject, redirectUrl: e.target.value })} placeholder="https://your-survey.com/complete" data-testid="input-redirect-url" />
                      {newProject.redirectUrl && !newProject.redirectUrl.startsWith('http://') && !newProject.redirectUrl.startsWith('https://') && (
                        <p className="text-sm text-destructive">URL must start with http:// or https://</p>
                      )}
                      <p className="text-xs text-muted-foreground">Where to send participants when time expires</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="end-screen-message">End Screen Message</Label>
                      <textarea 
                        id="end-screen-message" 
                        value={newProject.endScreenMessage} 
                        onChange={(e) => setNewProject({ ...newProject, endScreenMessage: e.target.value })} 
                        placeholder="Thank you for participating..." 
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        data-testid="input-end-screen-message" 
                      />
                      <p className="text-xs text-muted-foreground">Message shown when the feed ends before redirect</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={() => createProjectMutation.mutate(newProject)} 
                      disabled={!newProject.name || createProjectMutation.isPending || (newProject.redirectUrl ? !newProject.redirectUrl.startsWith('http://') && !newProject.redirectUrl.startsWith('https://') : false)} 
                      data-testid="button-create-project"
                    >
                      {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {projects.length === 0 ? (
              <Card className="p-12 text-center">
                <FolderOpen size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-4">Create your first project to start managing experiments</p>
                <Button onClick={() => setProjectDialogOpen(true)} className="bg-[#E4405F] hover:bg-[#D03050] text-white">
                  <Plus size={16} className="mr-2" /> Create Project
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <Card key={project.id} className="cursor-pointer hover:border-[#E4405F] transition-colors" onClick={() => setSelectedProjectId(project.id)} data-testid={`card-project-${project.id}`}>
                    <CardHeader>
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <CardDescription>
                        Query: {project.queryKey} • {Math.floor(project.timeLimitSeconds / 60)}m {project.timeLimitSeconds % 60}s limit
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground truncate">
                        {project.redirectUrl || 'No redirect URL set'}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : !selectedExperimentId ? (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" size="icon" onClick={() => setSelectedProjectId(null)} data-testid="button-back-projects">
                <ArrowLeft size={20} />
              </Button>
              <div className="flex-1">
                <h2 className="text-2xl font-bold tracking-tight">{selectedProject?.name}</h2>
                <p className="text-muted-foreground text-sm">Query: {selectedProject?.queryKey} • {Math.floor((selectedProject?.timeLimitSeconds || 0) / 60)}m limit</p>
              </div>
              <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setEditingProject(selectedProject || null)} data-testid="button-edit-project">
                    <Settings size={16} />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Project Settings</DialogTitle>
                  </DialogHeader>
                  {editingProject && (
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Project Name</Label>
                        <Input value={editingProject.name} onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Query String Key</Label>
                        <Input value={editingProject.queryKey} onChange={(e) => setEditingProject({ ...editingProject, queryKey: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Time Limit (seconds)</Label>
                        <Input type="number" value={editingProject.timeLimitSeconds} onChange={(e) => setEditingProject({ ...editingProject, timeLimitSeconds: parseInt(e.target.value) || 300 })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Redirect URL</Label>
                        <Input 
                          value={editingProject.redirectUrl} 
                          onChange={(e) => setEditingProject({ ...editingProject, redirectUrl: e.target.value })} 
                          placeholder="https://example.com/survey"
                        />
                        {editingProject.redirectUrl && !editingProject.redirectUrl.startsWith('http://') && !editingProject.redirectUrl.startsWith('https://') && (
                          <p className="text-sm text-destructive">URL must start with http:// or https://</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label>End Screen Message</Label>
                        <textarea 
                          value={editingProject.endScreenMessage} 
                          onChange={(e) => setEditingProject({ ...editingProject, endScreenMessage: e.target.value })} 
                          placeholder="Thank you for participating..."
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        <p className="text-xs text-muted-foreground">Message shown when the feed ends before redirect</p>
                      </div>
                    </div>
                  )}
                  <DialogFooter className="flex justify-between">
                    <Button variant="destructive" onClick={() => { deleteProjectMutation.mutate(editingProject!.id); setEditingProject(null); }}>
                      Delete Project
                    </Button>
                    <Button 
                      onClick={() => updateProjectMutation.mutate({ 
                        id: editingProject!.id, 
                        data: { 
                          name: editingProject!.name, 
                          queryKey: editingProject!.queryKey, 
                          timeLimitSeconds: editingProject!.timeLimitSeconds, 
                          redirectUrl: editingProject!.redirectUrl,
                          endScreenMessage: editingProject!.endScreenMessage
                        } 
                      })}
                      disabled={editingProject?.redirectUrl ? !editingProject.redirectUrl.startsWith('http://') && !editingProject.redirectUrl.startsWith('https://') : false}
                    >
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Feeds</h3>
              <Dialog open={experimentDialogOpen} onOpenChange={setExperimentDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-[#E4405F] hover:bg-[#D03050] text-white border-0" data-testid="button-new-feed">
                    <Plus size={16} /> New Feed
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Feed</DialogTitle>
                    <DialogDescription>Each feed has its own unique public URL for participants.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Feed Name</Label>
                      <Input value={newExperiment.name} onChange={(e) => setNewExperiment({ name: e.target.value })} placeholder="e.g., Condition A - High Engagement" data-testid="input-feed-name" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => createExperimentMutation.mutate(newExperiment)} disabled={!newExperiment.name || createExperimentMutation.isPending} data-testid="button-create-feed">
                      {createExperimentMutation.isPending ? 'Creating...' : 'Create Feed'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {experiments.length === 0 ? (
              <Card className="p-12 text-center">
                <Eye size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No feeds yet</h3>
                <p className="text-muted-foreground mb-4">Create a feed to start adding videos</p>
                <Button onClick={() => setExperimentDialogOpen(true)} className="bg-[#E4405F] hover:bg-[#D03050] text-white">
                  <Plus size={16} className="mr-2" /> Create Feed
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {experiments.map((exp) => (
                  <Card key={exp.id} className="cursor-pointer hover:border-[#E4405F] transition-colors" onClick={() => setSelectedExperimentId(exp.id)} data-testid={`card-feed-${exp.id}`}>
                    <CardHeader>
                      <CardTitle className="text-lg">{exp.name}</CardTitle>
                      <CardDescription className="truncate">
                        {window.location.origin}/feed/{exp.publicUrl}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <Button variant="ghost" size="icon" onClick={() => setSelectedExperimentId(null)} data-testid="button-back-feeds">
                <ArrowLeft size={20} />
              </Button>
              <div className="flex-1">
                <h2 className="text-2xl font-bold tracking-tight">{selectedExperiment?.name}</h2>
                <p className="text-muted-foreground text-sm">{selectedProject?.name}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => window.open(`/feed/${selectedExperiment?.publicUrl}?${selectedProject?.queryKey}=preview`, '_blank')} className="gap-2" data-testid="button-preview-feed">
                  <Eye size={16} /> Preview
                </Button>
                <Button variant="outline" onClick={copyPublicLink} className="gap-2" data-testid="button-copy-link">
                  <Share2 size={16} /> Copy Link
                </Button>
                <Dialog open={!!editingExperiment} onOpenChange={(open) => !open && setEditingExperiment(null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => setEditingExperiment(selectedExperiment || null)} data-testid="button-feed-settings">
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
                            <Label htmlFor="persist-timer">Persist Timer Across Reloads</Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              When enabled, the timer continues from where it left off if a participant refreshes the page. If time has expired, they will be redirected immediately.
                            </p>
                          </div>
                          <Switch
                            id="persist-timer"
                            checked={editingExperiment.persistTimer}
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
                            checked={editingExperiment.showUnmutePrompt}
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
                          data: { name: editingExperiment!.name, persistTimer: editingExperiment!.persistTimer, showUnmutePrompt: editingExperiment!.showUnmutePrompt } 
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
                  <CardTitle>Feed Videos</CardTitle>
                  <CardDescription>
                    Manage the videos visible to participants. Drag to reorder.
                  </CardDescription>
                </div>
                <Button onClick={handleAddNewVideo} className="gap-2 bg-[#E4405F] hover:bg-[#D03050] text-white border-0" data-testid="button-add-video">
                  <Plus size={16} /> Add Video
                </Button>
              </CardHeader>
              <CardContent>
                {videos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No videos in this feed yet.</p>
                    <p className="text-sm mt-1">Add videos via the API or upload interface.</p>
                  </div>
                ) : (
                  <>
                  {selectedVideoIds.size > 0 && (
                    <div className="mb-4 p-4 bg-muted rounded-lg flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{selectedVideoIds.size} video(s) selected</span>
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
                              <AlertDialogTitle>Delete {selectedVideoIds.size} video(s)?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove the selected videos from the feed. This action cannot be undone.
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
                              checked={videos.length > 0 && selectedVideoIds.size === videos.length}
                              onCheckedChange={handleSelectAll}
                              data-testid="checkbox-select-all"
                            />
                          </TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead className="w-[100px]">Thumbnail</TableHead>
                          <TableHead>Caption</TableHead>
                          <TableHead>Metrics</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <SortableContext items={videos} strategy={verticalListSortingStrategy}>
                          {videos.map((video) => (
                            <SortableRow 
                              key={video.id} 
                              video={video}
                              isSelected={selectedVideoIds.has(video.id)}
                              onSelect={handleVideoSelect}
                              onDelete={(id) => deleteVideoMutation.mutate(id)}
                              onPreview={(id) => setPreviewingVideo(videos.find(v => v.id === id) || null)}
                              onEdit={(v) => { setUploadStatus('idle'); setEditingVideo(v); }}
                              onManageComments={(v) => setManagingCommentsVideo(v)}
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

            <Dialog open={!!editingVideo} onOpenChange={(open) => !open && setEditingVideo(null)}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{isNewVideo ? 'Add Video' : 'Edit Video'}</DialogTitle>
                  <DialogDescription>
                    {isNewVideo ? 'Add a new video to the feed.' : 'Update the video details displayed to participants.'}
                  </DialogDescription>
                </DialogHeader>
                {editingVideo && (
                  <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid gap-2">
                      <Label>Video/Image</Label>
                      <div className="space-y-3">
                        {editingVideo.url ? (
                          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                            <div className="w-16 h-24 rounded overflow-hidden bg-gray-200 shrink-0">
                              <img src={editingVideo.url} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-sm text-green-600">
                                <CheckCircle2 size={16} />
                                <span>{isNewVideo ? 'File uploaded successfully' : 'Current media'}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 truncate">{editingVideo.url}</p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingVideo({ ...editingVideo, url: '' });
                                setUploadStatus('idle');
                              }}
                            >
                              Change
                            </Button>
                          </div>
                        ) : uploadStatus === 'uploading' || uploadStatus === 'finalizing' ? (
                          <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
                            <Loader2 className="animate-spin" size={20} />
                            <span className="text-sm text-muted-foreground">
                              {uploadStatus === 'uploading' ? 'Uploading file...' : 'Processing...'}
                            </span>
                          </div>
                        ) : (
                          <ObjectUploader
                            maxNumberOfFiles={1}
                            maxFileSize={104857600}
                            allowedFileTypes={['image/*', 'video/*']}
                            onGetUploadParameters={async () => {
                              setUploadStatus('uploading');
                              const res = await apiRequest('POST', '/api/objects/upload', {});
                              const data = await res.json();
                              return {
                                method: 'PUT' as const,
                                url: data.uploadURL,
                              };
                            }}
                            onComplete={async (result) => {
                              if (result.successful && result.successful.length > 0) {
                                const uploadURL = result.successful[0].uploadURL;
                                setUploadStatus('finalizing');
                                try {
                                  const res = await apiRequest('PUT', '/api/objects/finalize', { uploadURL });
                                  const data = await res.json();
                                  setEditingVideo(prev => prev ? { ...prev, url: data.objectPath } : null);
                                  setUploadStatus('done');
                                } catch (err) {
                                  console.error('Error finalizing upload:', err);
                                  setUploadStatus('idle');
                                  toast({ title: 'Upload failed', description: 'Could not process the file.', variant: 'destructive' });
                                }
                              } else {
                                setUploadStatus('idle');
                              }
                            }}
                            buttonClassName="w-full h-24 border-dashed"
                          >
                            <div className="flex flex-col items-center gap-2">
                              <Upload size={24} className="text-muted-foreground" />
                              <span className="text-sm">Click to upload video or image</span>
                            </div>
                          </ObjectUploader>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="video-username">Username</Label>
                      <Input 
                        id="video-username" 
                        value={editingVideo.username} 
                        onChange={(e) => setEditingVideo({ ...editingVideo, username: e.target.value })} 
                        placeholder="username"
                        data-testid="input-video-username"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="video-caption">Caption</Label>
                      <Input 
                        id="video-caption" 
                        value={editingVideo.caption} 
                        onChange={(e) => setEditingVideo({ ...editingVideo, caption: e.target.value })} 
                        placeholder="Video caption..."
                        data-testid="input-video-caption"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="video-likes">Likes</Label>
                        <Input 
                          id="video-likes" 
                          type="number" 
                          value={editingVideo.likes} 
                          onChange={(e) => setEditingVideo({ ...editingVideo, likes: parseInt(e.target.value) || 0 })} 
                          data-testid="input-video-likes"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="video-comments">Comments</Label>
                        <Input 
                          id="video-comments" 
                          type="number" 
                          value={editingVideo.comments} 
                          onChange={(e) => setEditingVideo({ ...editingVideo, comments: parseInt(e.target.value) || 0 })} 
                          data-testid="input-video-comments"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="video-shares">Shares</Label>
                        <Input 
                          id="video-shares" 
                          type="number" 
                          value={editingVideo.shares} 
                          onChange={(e) => setEditingVideo({ ...editingVideo, shares: parseInt(e.target.value) || 0 })} 
                          data-testid="input-video-shares"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingVideo(null)}
                    data-testid="button-cancel-edit-video"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      if (!editingVideo) return;
                      if (isNewVideo) {
                        const seed = Math.random().toString(36).substring(7);
                        createVideoMutation.mutate({
                          url: editingVideo.url,
                          username: editingVideo.username,
                          userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${editingVideo.username}_${seed}`,
                          caption: editingVideo.caption,
                          likes: editingVideo.likes,
                          comments: editingVideo.comments,
                          shares: editingVideo.shares,
                        });
                      } else {
                        updateVideoMutation.mutate({ 
                          id: editingVideo.id, 
                          data: {
                            url: editingVideo.url,
                            username: editingVideo.username,
                            caption: editingVideo.caption,
                            likes: editingVideo.likes,
                            comments: editingVideo.comments,
                            shares: editingVideo.shares,
                          }
                        });
                      }
                    }}
                    disabled={isNewVideo ? createVideoMutation.isPending : updateVideoMutation.isPending}
                    data-testid="button-save-video"
                  >
                    {isNewVideo 
                      ? (createVideoMutation.isPending ? 'Adding...' : 'Add Video')
                      : (updateVideoMutation.isPending ? 'Saving...' : 'Save Changes')
                    }
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
        )}
      </main>
    </div>
  );
}
