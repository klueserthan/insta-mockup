
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from './utils';
import { ProjectList } from '@/components/dashboard/ProjectList';
import type { Project } from '@/lib/api-types';
import * as queryClientModule from '@/lib/queryClient';

// Mock apiRequest
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

describe('ProjectList', () => {
  const mockProjects: Project[] = [
    { id: '1', name: 'Project A', queryKey: 'pk', timeLimitSeconds: 60, redirectUrl: '', endScreenMessage: '', lockAllPositions: false, randomizationSeed: 0, createdAt: '', researcherId: 'r1' },
    { id: '2', name: 'Project B', queryKey: 'pk2', timeLimitSeconds: 120, redirectUrl: '', endScreenMessage: '', lockAllPositions: false, randomizationSeed: 0, createdAt: '', researcherId: 'r1' },
  ];

  const mockOnSelectProject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders project list', () => {
    renderWithProviders(<ProjectList projects={mockProjects} onSelectProject={mockOnSelectProject} />);
    
    expect(screen.getByText('Your Projects')).toBeInTheDocument();
    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Project B')).toBeInTheDocument();
  });

  it('calls onSelectProject when a project card is clicked', async () => {
    const { user } = renderWithProviders(<ProjectList projects={mockProjects} onSelectProject={mockOnSelectProject} />);
    
    await user.click(screen.getByTestId('card-project-1'));
    expect(mockOnSelectProject).toHaveBeenCalledWith('1');
  });

  it('opens create project dialog and creates project', async () => {
    // Setup mock return for create
    (queryClientModule.apiRequest as any).mockResolvedValue({
      json: () => Promise.resolve({ id: '3', name: 'New Project' })
    });

    const { user } = renderWithProviders(<ProjectList projects={mockProjects} onSelectProject={mockOnSelectProject} />);
    
    await user.click(screen.getByTestId('button-new-project'));
    
    expect(screen.getByText('Create New Project')).toBeInTheDocument();
    
    await user.type(screen.getByTestId('input-project-name'), 'My New Study');
    await user.click(screen.getByTestId('button-create-project'));
    
    await waitFor(() => {
      expect(queryClientModule.apiRequest).toHaveBeenCalledWith('POST', '/api/projects', expect.objectContaining({
        name: 'My New Study'
      }));
    });
  });
});
