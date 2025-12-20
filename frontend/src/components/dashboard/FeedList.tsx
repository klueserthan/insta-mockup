
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Settings, Plus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Project, Experiment } from '@/lib/api-types';
import { useToast } from '@/hooks/use-toast';

interface FeedListProps {
  project: Project;
  experiments: Experiment[];
  onSelectFeed: (id: string) => void;
  onBack: () => void;
}

export function FeedList({ project, experiments, onSelectFeed, onBack }: FeedListProps) {
  const { toast } = useToast();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [experimentDialogOpen, setExperimentDialogOpen] = useState(false);
  const [newExperiment, setNewExperiment] = useState({ name: '' });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Project> }) => {
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
      onBack(); // Go back to project list
      toast({ title: 'Project deleted' });
    },
  });

  const createExperimentMutation = useMutation({
    mutationFn: async (data: typeof newExperiment) => {
      const res = await apiRequest('POST', `/api/projects/${project.id}/experiments`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'experiments'] });
      setExperimentDialogOpen(false);
      setNewExperiment({ name: '' });
      toast({ title: 'Feed created', description: 'Your new feed is ready.' });
    },
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-projects">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
          <p className="text-muted-foreground text-sm">Query: {project.queryKey} • {Math.floor((project.timeLimitSeconds || 0) / 60)}m limit</p>
        </div>
        <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" onClick={() => setEditingProject(project)} data-testid="button-edit-project">
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
                    value={editingProject.redirectUrl || ''} 
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
                    value={editingProject.endScreenMessage || ''} 
                    onChange={(e) => setEditingProject({ ...editingProject, endScreenMessage: e.target.value })} 
                    placeholder="Thank you for participating..."
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-xs text-muted-foreground">Message shown when the feed ends before redirect</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="grid gap-1">
                    <Label>Lock All Positions</Label>
                    <p className="text-xs text-muted-foreground">Disable feed randomization entirely</p>
                  </div>
                  <Switch 
                    checked={editingProject.lockAllPositions || false}
                    onCheckedChange={(checked) => setEditingProject({ ...editingProject, lockAllPositions: checked })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Randomization Seed</Label>
                  <Input 
                    type="number" 
                    value={editingProject.randomizationSeed || 42} 
                    onChange={(e) => setEditingProject({ ...editingProject, randomizationSeed: parseInt(e.target.value) || 42 })} 
                    disabled={editingProject.lockAllPositions}
                  />
                  <p className="text-xs text-muted-foreground">Seed for deterministic randomization of unlocked items</p>
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
                    endScreenMessage: editingProject!.endScreenMessage,
                    lockAllPositions: editingProject!.lockAllPositions,
                    randomizationSeed: editingProject!.randomizationSeed
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
            <Card key={exp.id} className="cursor-pointer hover:border-[#E4405F] transition-colors" onClick={() => onSelectFeed(exp.id)} data-testid={`card-feed-${exp.id}`}>
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
  );
}
