
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Project } from '@/lib/api-types';
import { useToast } from '@/hooks/use-toast';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (id: string) => void;
}

export function ProjectList({ projects, onSelectProject }: ProjectListProps) {
  const { toast } = useToast();
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ 
    name: '', 
    queryKey: 'participantId', 
    timeLimitSeconds: 300, 
    redirectUrl: '', 
    endScreenMessage: 'Thank you for participating in this study. You will be redirected shortly.', 
    lockAllPositions: false, 
    randomizationSeed: 42 
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: typeof newProject) => {
      const res = await apiRequest('POST', '/api/projects', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setProjectDialogOpen(false);
      setNewProject({ 
        name: '', 
        queryKey: 'participantId', 
        timeLimitSeconds: 300, 
        redirectUrl: '', 
        endScreenMessage: 'Thank you for participating in this study. You will be redirected shortly.', 
        lockAllPositions: false, 
        randomizationSeed: 42 
      });
      toast({ title: 'Project created', description: 'Your new project is ready.' });
    },
  });

  return (
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
              <div className="flex items-center justify-between">
                <div className="grid gap-1">
                  <Label htmlFor="lock-all-positions">Lock All Positions</Label>
                  <p className="text-xs text-muted-foreground">Disable feed randomization entirely</p>
                </div>
                <Switch 
                  id="lock-all-positions"
                  checked={newProject.lockAllPositions}
                  onCheckedChange={(checked) => setNewProject({ ...newProject, lockAllPositions: checked })}
                  data-testid="switch-lock-all-positions"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="randomization-seed">Randomization Seed</Label>
                <Input 
                  id="randomization-seed" 
                  type="number" 
                  value={newProject.randomizationSeed} 
                  onChange={(e) => setNewProject({ ...newProject, randomizationSeed: parseInt(e.target.value) || 42 })} 
                  disabled={newProject.lockAllPositions}
                  data-testid="input-randomization-seed" 
                />
                <p className="text-xs text-muted-foreground">Seed for deterministic randomization of unlocked items</p>
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
            <Card key={project.id} className="cursor-pointer hover:border-[#E4405F] transition-colors" onClick={() => onSelectProject(project.id)} data-testid={`card-project-${project.id}`}>
              <CardHeader>
                <CardTitle className="text-lg">{project.name}</CardTitle>
                <CardDescription>
                  Query: {project.queryKey} • {Math.floor((project.timeLimitSeconds || 0) / 60)}m {(project.timeLimitSeconds || 0) % 60}s limit
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
  );
}
