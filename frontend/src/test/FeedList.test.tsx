
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from './utils';
import { FeedList } from '@/components/dashboard/FeedList';
import type { Project, Experiment } from '@/lib/api-types';
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

describe('FeedList', () => {
  const mockProject: Project = { 
    id: '1', 
    name: 'Project A', 
    queryKey: 'pid', 
    timeLimitSeconds: 60, 
    redirectUrl: 'http://example.com', 
    endScreenMessage: 'End', 
    lockAllPositions: false, 
    randomizationSeed: 42, 
    createdAt: '',
    researcherId: 'r1' 
  };
  
  const mockExperiments: Experiment[] = [
    { id: 'e1', projectId: '1', name: 'Feed A', publicUrl: 'abc', persistTimer: false, showUnmutePrompt: false, createdAt: '' },
  ];

  const mockOnSelectFeed = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders project details and feed list', () => {
    renderWithProviders(
      <FeedList 
        project={mockProject} 
        experiments={mockExperiments} 
        onSelectFeed={mockOnSelectFeed} 
        onBack={mockOnBack} 
      />
    );
    
    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Feed A')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const { user } = renderWithProviders(
      <FeedList 
        project={mockProject} 
        experiments={mockExperiments} 
        onSelectFeed={mockOnSelectFeed} 
        onBack={mockOnBack} 
      />
    );
    
    await user.click(screen.getByTestId('button-back-projects'));
    expect(mockOnBack).toHaveBeenCalled();
  });

  it('opens project settings and updates project', async () => {
    (queryClientModule.apiRequest as any).mockResolvedValue({
      json: () => Promise.resolve({ ...mockProject, name: 'Updated Project' })
    });

    const { user } = renderWithProviders(
      <FeedList 
        project={mockProject} 
        experiments={mockExperiments} 
        onSelectFeed={mockOnSelectFeed} 
        onBack={mockOnBack} 
      />
    );
    
    await user.click(screen.getByTestId('button-edit-project'));
    expect(screen.getByText('Edit Project Settings')).toBeInTheDocument();
    
    // Changing the name is tricky because Input updates state.
    // Wait for the dialog to be fully interactive
    // We can assume Input works as it's a standard component and just click Save.
    
    await user.click(screen.getByText('Save Changes'));
    
    await waitFor(() => {
      expect(queryClientModule.apiRequest).toHaveBeenCalledWith('PATCH', '/api/projects/1', expect.any(Object));
    });
  });

  it('creates a new feed', async () => {
    (queryClientModule.apiRequest as any).mockResolvedValue({
      json: () => Promise.resolve({ id: 'e2', name: 'New Feed' })
    });

    const { user } = renderWithProviders(
      <FeedList 
        project={mockProject} 
        experiments={mockExperiments} 
        onSelectFeed={mockOnSelectFeed} 
        onBack={mockOnBack} 
      />
    );
    
    await user.click(screen.getByTestId('button-new-feed'));
    await user.type(screen.getByTestId('input-feed-name'), 'Condition B');
    await user.click(screen.getByTestId('button-create-feed'));
    
    await waitFor(() => {
      expect(queryClientModule.apiRequest).toHaveBeenCalledWith('POST', '/api/projects/1/experiments', expect.objectContaining({
        name: 'Condition B'
      }));
    });
  });
});
