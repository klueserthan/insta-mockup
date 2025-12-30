
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { fetchWithAuth } from '@/lib/queryClient';
import type { Project, Experiment, Video } from '@/lib/api-types';
import { ProjectList } from '@/components/dashboard/ProjectList';
import { FeedList } from '@/components/dashboard/FeedList';
import { MediaManager } from '@/components/dashboard/MediaManager';
import { Results } from '@/components/dashboard/Results';

type ViewMode = 'media' | 'results';

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, logoutMutation } = useAuth();
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('media');

  // Reset viewMode to 'media' when changing experiments
  useEffect(() => {
    setViewMode('media');
  }, [selectedExperimentId]);

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
  
  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => setLocation('/'),
    });
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
            <ProjectList 
                projects={projects} 
                onSelectProject={setSelectedProjectId} 
            />
        ) : !selectedExperimentId ? (
            selectedProject ? (
                <FeedList 
                    project={selectedProject}
                    experiments={experiments}
                    onSelectFeed={setSelectedExperimentId}
                    onBack={() => setSelectedProjectId(null)}
                />
            ) : (
                <div className="text-center py-8">
                    <p className="text-muted-foreground">Project not found. It might have been deleted.</p>
                    <Button variant="ghost" className="mt-4" onClick={() => setSelectedProjectId(null)}>
                        Back to projects
                    </Button>
                </div>
            )
        ) : (
            selectedProject && selectedExperiment ? (
                viewMode === 'media' ? (
                    <MediaManager
                        project={selectedProject}
                        experiment={selectedExperiment}
                        videos={videos}
                        onBack={() => setSelectedExperimentId(null)}
                        onViewResults={() => setViewMode('results')}
                    />
                ) : (
                    <Results
                        experiment={selectedExperiment}
                        onBack={() => setViewMode('media')}
                    />
                )
            ) : (
                <div className="text-center py-8">
                    <p className="text-muted-foreground">Feed not found. It might have been deleted.</p>
                    <Button variant="ghost" className="mt-4" onClick={() => setSelectedExperimentId(null)}>
                        Back to feed list
                    </Button>
                </div>
            )
        )}
      </main>
    </div>
  );
}
