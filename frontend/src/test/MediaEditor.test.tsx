
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from './utils';
import { MediaEditor } from '@/components/dashboard/MediaEditor';
import type { Video } from '@/lib/api-types';
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

// Mock ObjectUploader to avoid complex upload logic test
vi.mock('@/components/ObjectUploader', () => ({
  ObjectUploader: ({ onComplete }: any) => (
    <button onClick={() => onComplete({ successful: [{ response: { body: { url: 'http://example.com/video.mp4' } } }] })}>
      Mock Upload
    </button>
  )
}));

describe('MediaEditor', () => {
  const mockVideo: Video = {
    id: 'v1',
    url: 'http://test.com/vid.mp4',
    username: 'user1',
    caption: 'Test Caption',
    likes: 10,
    comments: 5,
    shares: 2,
    song: '',
    userAvatar: '',
    position: 0,
    experimentId: 'e1',
    createdAt: ''
  };

  const newVideo: Video = { ...mockVideo, id: '', url: '' };

  const mockOnOpenChange = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders edit form with video data', () => {
    renderWithProviders(
      <MediaEditor 
        video={mockVideo} 
        experimentId="e1" 
        open={true} 
        onOpenChange={mockOnOpenChange} 
      />
    );
    
    expect(screen.getByText('Edit Media')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Caption')).toBeInTheDocument();
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
  });

  it('renders add form for new video', () => {
    renderWithProviders(
      <MediaEditor 
        video={newVideo} 
        experimentId="e1" 
        open={true} 
        onOpenChange={mockOnOpenChange} 
      />
    );
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add Media' })).toBeInTheDocument();
    expect(screen.getByText('Media Source')).toBeInTheDocument();
  });

  it('updates video details on save', async () => {
    (queryClientModule.apiRequest as any).mockResolvedValue({
      json: () => Promise.resolve({ ...mockVideo, caption: 'New Caption' })
    });

    const { user } = renderWithProviders(
      <MediaEditor 
        video={mockVideo} 
        experimentId="e1" 
        open={true} 
        onOpenChange={mockOnOpenChange}
        onSave={mockOnSave}
      />
    );
    
    const captionInput = screen.getByTestId('input-video-caption');
    await user.clear(captionInput);
    await user.type(captionInput, 'New Caption');
    
    await user.click(screen.getByTestId('button-save-media'));
    
    await waitFor(() => {
      expect(queryClientModule.apiRequest).toHaveBeenCalledWith('PATCH', '/api/videos/v1', expect.objectContaining({
        caption: 'New Caption'
      }));
      expect(mockOnSave).toHaveBeenCalled();
    });
  });

  it('handles instagram ingest', async () => {
    (queryClientModule.apiRequest as any).mockResolvedValue({
      json: () => Promise.resolve({ 
        url: 'http://insta.com/vid.mp4',
        username: 'instauser',
        caption: 'Insta Caption',
        likes: 100
      })
    });

    const { user } = renderWithProviders(
      <MediaEditor 
        video={newVideo} 
        experimentId="e1" 
        open={true} 
        onOpenChange={mockOnOpenChange} 
      />
    );
    
    await user.click(screen.getByText('Instagram'));
    await user.type(screen.getByTestId('input-instagram-url'), 'http://instagram.com/p/123');
    await user.click(screen.getByTestId('button-ingest'));
    
    await waitFor(() => {
      expect(queryClientModule.apiRequest).toHaveBeenCalledWith('POST', '/api/instagram/ingest', expect.anything());
      // Verify form updated
      expect(screen.getByDisplayValue('Insta Caption')).toBeInTheDocument();
      expect(screen.getByDisplayValue('instauser')).toBeInTheDocument();
    });
  });
});
