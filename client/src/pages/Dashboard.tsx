import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Share2, BarChart3, ExternalLink, Trash2, Eye, GripVertical, FolderOpen, Settings, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
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
  onDelete: (id: string) => void;
  onPreview: (id: string) => void;
}

function SortableRow({ video, onDelete, onPreview }: SortableRowProps) {
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
    <TableRow ref={setNodeRef} style={style} {...attributes} className={isDragging ? 'opacity-50' : ''}>
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
          <Button variant="ghost" size="icon" title="Preview" onClick={() => onPreview(video.id)} data-testid={`button-preview-${video.id}`}>
            <ExternalLink size={16} />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" title="Remove" onClick={() => onDelete(video.id)} data-testid={`button-delete-${video.id}`}>
            <Trash2 size={16} />
          </Button>
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
  
  const [newProject, setNewProject] = useState({ name: '', queryKey: 'participantId', timeLimitSeconds: 300, redirectUrl: '' });
  const [newExperiment, setNewExperiment] = useState({ name: '' });

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
      const res = await fetch(`/api/projects/${selectedProjectId}/experiments`, { credentials: 'include' });
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: videos = [] } = useQuery<Video[]>({
    queryKey: ['/api/experiments', selectedExperimentId, 'videos'],
    queryFn: async () => {
      if (!selectedExperimentId) return [];
      const res = await fetch(`/api/experiments/${selectedExperimentId}/videos`, { credentials: 'include' });
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
      setNewProject({ name: '', queryKey: 'participantId', timeLimitSeconds: 300, redirectUrl: '' });
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
                      <p className="text-xs text-muted-foreground">Where to send participants when time expires</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => createProjectMutation.mutate(newProject)} disabled={!newProject.name || createProjectMutation.isPending} data-testid="button-create-project">
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
                        <Input value={editingProject.redirectUrl} onChange={(e) => setEditingProject({ ...editingProject, redirectUrl: e.target.value })} />
                      </div>
                    </div>
                  )}
                  <DialogFooter className="flex justify-between">
                    <Button variant="destructive" onClick={() => { deleteProjectMutation.mutate(editingProject!.id); setEditingProject(null); }}>
                      Delete Project
                    </Button>
                    <Button onClick={() => updateProjectMutation.mutate({ id: editingProject!.id, data: editingProject! })}>
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
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Feed Videos</CardTitle>
                <CardDescription>
                  Manage the videos visible to participants. Drag to reorder.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {videos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No videos in this feed yet.</p>
                    <p className="text-sm mt-1">Add videos via the API or upload interface.</p>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <Table>
                      <TableHeader>
                        <TableRow>
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
                              onDelete={(id) => deleteVideoMutation.mutate(id)}
                              onPreview={(id) => {}}
                            />
                          ))}
                        </SortableContext>
                      </TableBody>
                    </Table>
                  </DndContext>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
