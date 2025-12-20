
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from './utils';
import { MediaManager } from '@/components/dashboard/MediaManager';
import type { Project, Experiment, Video } from '@/lib/api-types';
import * as queryClientModule from '@/lib/queryClient';

vi.mock('@/lib/queryClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/queryClient')>();
  return {
    ...actual,
    apiRequest: vi.fn(),
    queryClient: {
      invalidateQueries: vi.fn(),
    }
  };
});

describe('MediaManager', () => {
  const mockProject: Project = { 
    id: '1', 
    name: 'Project A', 
    queryKey: 'pid', 
    timeLimitSeconds: 60, 
    redirectUrl: '', 
    endScreenMessage: '', 
    lockAllPositions: false, 
    randomizationSeed: 0, 
    createdAt: '',
    researcherId: 'r1' 
  };
  
  const mockExperiment: Experiment = { 
    id: 'e1', 
    projectId: '1', 
    name: 'Feed A', 
    publicUrl: 'abc', 
    persistTimer: false, 
    showUnmutePrompt: false, 
    createdAt: '' 
  };

  const mockVideos: Video[] = [
    { id: 'v1', url: 'u1', username: 'user1', caption: 'Cap 1', likes: 10, comments: 2, shares: 1, song: '', userAvatar: '', position: 0, experimentId: 'e1', createdAt: '' },
    { id: 'v2', url: 'u2', username: 'user2', caption: 'Cap 2', likes: 20, comments: 4, shares: 2, song: '', userAvatar: '', position: 1, experimentId: 'e1', createdAt: '' },
  ];

  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders feed header and videos list', () => {
    renderWithProviders(
      <MediaManager 
        project={mockProject} 
        experiment={mockExperiment} 
        videos={mockVideos} 
        onBack={mockOnBack} 
      />
    );
    
    expect(screen.getByText('Feed A')).toBeInTheDocument();
    expect(screen.getByText('Cap 1')).toBeInTheDocument();
    expect(screen.getByText('Cap 2')).toBeInTheDocument();
  });

  it('selects videos and shows bulk actions', async () => {
    const { user } = renderWithProviders(
      <MediaManager 
        project={mockProject} 
        experiment={mockExperiment} 
        videos={mockVideos} 
        onBack={mockOnBack} 
      />
    );
    
    await user.click(screen.getByTestId('checkbox-video-v1'));
    expect(screen.getByText('1 media item(s) selected')).toBeInTheDocument();
    expect(screen.getByTestId('button-bulk-delete')).toBeInTheDocument();
    expect(screen.getByTestId('button-bulk-generate-comments')).toBeInTheDocument();
  });

  it('opens media editor for new video', async () => {
    const { user } = renderWithProviders(
      <MediaManager 
        project={mockProject} 
        experiment={mockExperiment} 
        videos={mockVideos} 
        onBack={mockOnBack} 
      />
    );
    
    await user.click(screen.getByTestId('button-add-video'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add Media' })).toBeInTheDocument();
  });

  it('deletes a video', async () => {
    const { user } = renderWithProviders(
      <MediaManager 
        project={mockProject} 
        experiment={mockExperiment} 
        videos={mockVideos} 
        onBack={mockOnBack} 
      />
    );
    
    // Open delete dialog
    await user.click(screen.getByTestId('button-delete-v1'));
    // Confirm delete
    await user.click(screen.getByTestId('button-confirm-delete'));
    
    await waitFor(() => {
      expect(queryClientModule.apiRequest).toHaveBeenCalledWith('DELETE', '/api/videos/v1');
    });
  });
});
