
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
    fetchWithAuth: vi.fn(),
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
    filename: 'vid.mp4',
    socialAccountId: 'acc1',
    socialAccount: {
        id: 'acc1',
        researcherId: 'r1',
        username: 'user1',
        displayName: 'User One',
        avatarUrl: 'http://avatar.jpg'
    },
    caption: 'Test Caption',
    likes: 10,
    comments: 5,
    shares: 2,
    song: '',
    position: 0,
    experimentId: 'e1',
    createdAt: ''
  };

  const newVideo: Video = { ...mockVideo, id: '', filename: '', socialAccountId: '', socialAccount: undefined };

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
        projectId="p1"
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
        projectId="p1"
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
        projectId="p1"
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
        type: 'single',
        filename: 'ingested-uuid.mp4',
        author: {
            username: 'instauser',
            full_name: 'Insta User',
            profile_pic_filename: 'avatar.jpg'
        },
        caption: 'Insta Caption',
        likes: 100
      })
    });

    const { user } = renderWithProviders(
      <MediaEditor 
        video={newVideo} 
        experimentId="e1" 
        projectId="p1"
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

  it('handles instagram save directly (no upload needed)', async () => {
    // 1. Mock Ingest Response
    (queryClientModule.apiRequest as any).mockResolvedValueOnce({
        json: () => Promise.resolve({ 
          type: 'single',
          filename: 'direct-ingested.mp4',
          author: { username: 'instauser', full_name: 'User', profile_pic_filename: 'avatar.jpg' },
          caption: 'My Caption'
        })
    });

    const { user } = renderWithProviders(
      <MediaEditor video={newVideo} experimentId="e1" projectId="p1" open={true} onOpenChange={mockOnOpenChange} onSave={mockOnSave} />
    );

    // Ingest
    await user.click(screen.getByText('Instagram'));
    await user.type(screen.getByTestId('input-instagram-url'), 'http://instagram.com/p/123');
    await user.click(screen.getByTestId('button-ingest'));

    await waitFor(() => expect(screen.getByDisplayValue('My Caption')).toBeInTheDocument());

    // 2. Mock Create Video
    (queryClientModule.apiRequest as any).mockResolvedValueOnce({
        json: () => Promise.resolve({ ...mockVideo, id: 'new-v' })
    });

    // Save
    await user.click(screen.getByTestId('button-save-media'));

    await waitFor(() => {
        // No proxy calls expected
        expect(queryClientModule.fetchWithAuth).not.toHaveBeenCalledWith(expect.stringContaining('/api/instagram/proxy'));
        
        expect(queryClientModule.apiRequest).toHaveBeenCalledWith('POST', '/api/experiments/e1/videos', expect.objectContaining({
            filename: 'direct-ingested.mp4'
        }));
        expect(mockOnSave).toHaveBeenCalled();
    });
  });

});
