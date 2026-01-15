
import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Upload, Sparkles, XCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest, queryClient, fetchWithAuth } from '@/lib/queryClient';
import type { Video, InsertSocialAccount, SocialAccount } from '@/lib/api-types';
import { useToast } from '@/hooks/use-toast';
import { ObjectUploader } from '@/components/ObjectUploader';

interface MediaEditorProps {
  video: Video;
  experimentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function MediaEditor({ video: initialVideo, projectId, experimentId, open, onOpenChange, onSave }: MediaEditorProps & { projectId: string }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Video>(initialVideo);

  // Helper to proxy Instagram CDN URLs to avoid CORS/CORB issues
  const getProxiedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
        return `/api/instagram/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  // Carousel State - REMOVED per backend changes
  // const [carouselCandidates, setCarouselCandidates] = useState<{id: string, type: string, url: string}[]>([]);
  // const [showCarouselSelection, setShowCarouselSelection] = useState(false);

  const [ingestMode, setIngestMode] = useState<'upload' | 'instagram'>('upload');
  const [ingestUrl, setIngestUrl] = useState("");
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'finalizing' | 'done'>('idle');
  
  // Account state
  const [selectedAccountId, setSelectedAccountId] = useState<string>("new");
  const [newAccount, setNewAccount] = useState<InsertSocialAccount>({
    username: '',
    displayName: '',
    avatarUrl: '',
  });
  const [accountError, setAccountError] = useState<string | null>(null);
  const [avatarMode, setAvatarMode] = useState<'url' | 'upload'>('url');

  const isNewVideo = !initialVideo.id;

  // Initialize selectedAccountId when opening dialog or when video changes
  useEffect(() => {
    if (open) {
      // When opening the dialog for an existing video with a socialAccountId, select it
      if (!isNewVideo && initialVideo.socialAccountId) {
        setSelectedAccountId(initialVideo.socialAccountId);
      } else {
        setSelectedAccountId("new");
      }
    }
  }, [open, initialVideo.id, initialVideo.socialAccountId, isNewVideo]);

  const { data: accounts = [] } = useQuery<SocialAccount[]>({
    queryKey: ['/api/accounts'],
  });

  const createVideoMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', `/api/experiments/${experimentId}/videos`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments', experimentId, 'videos'] });
      toast({ title: 'Media added', description: 'New media added to the feed.' });
      onOpenChange(false);
      onSave?.();
    },
  });

  const updateVideoMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Video> }) => {
      const res = await apiRequest('PATCH', `/api/videos/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/experiments', experimentId, 'videos'] });
      toast({ title: 'Media updated', description: 'Media details saved successfully.' });
      onOpenChange(false);
      onSave?.();
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: Partial<InsertSocialAccount>) => {
      const res = await apiRequest('POST', '/api/accounts', data);
      return res.json();
    },
    onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
        setSelectedAccountId(data.id);
        setAccountError(null);
        setFormData(prev => ({
            ...prev,
            socialAccountId: data.id
        }));
        toast({ title: "Account created", description: "New social account saved." });
    },
    onError: (error: Error) => {
        if (error.message.includes("409")) {
            setAccountError("Username already exists. Please choose a unique username.");
        } else {
            setAccountError("Failed to create account. " + error.message);
        }
    }
  });

  // Ingested Data State
  const [ingestedData, setIngestedData] = useState<{
    filename: string;
    author: { username: string; full_name: string; profile_pic_filename: string };
  } | null>(null);

  const ingestInstagramMutation = useMutation({
    mutationFn: async (payload: { url: string }) => {
      // Backend no longer needs project_id/feed_id for ingest (it's flat/global ingest to uploads now?)
      // Actually backend request model only has `url`.
      const res = await apiRequest('POST', '/api/instagram/ingest', {
        ...payload
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      // Backend raises 501 for carousel, so we don't need to handle it here (onError will catch)
      
      // Store ingested data (already local filenames)
      setIngestedData({
        filename: data.filename,
        author: data.author
      });

      setFormData(prev => ({
        ...prev,
        filename: data.filename, // Set immediately as it's already downloaded
        caption: data.caption || '',
        likes: data.likes || 0,
        comments: data.comments || 0,
        shares: data.shares || 0,
      }));
      
      // Auto-populate new account fields
      if (data.author) {
        setNewAccount({
            username: data.author.username,
            displayName: data.author.full_name,
            avatarUrl: `/media/${data.author.profile_pic_filename}` // Use local path
        });
        setSelectedAccountId("new");
      }
      
      toast({ title: 'Instagram Imported', description: 'Media available locally.' });
    },
    onError: (err: any) => {
        toast({ title: 'Import Failed', description: err.message, variant: 'destructive' });
    }
  });

  const uploadFileFromUrl = async (url: string): Promise<string> => {
    // 1. Fetch Blob via Proxy
    const proxyRes = await fetchWithAuth(`/api/instagram/proxy?url=${encodeURIComponent(url)}`);
    if (!proxyRes.ok) throw new Error("Failed to fetch media from proxy");
    const blob = await proxyRes.blob();

    // 2. Upload to Storage
    const uploadFormData = new FormData();
    // Guess extension
    const type = blob.type;
    const ext = type.includes('video') ? 'mp4' : 'jpg';
    uploadFormData.append("file", blob, `insta_media.${ext}`);

    const uploadRes = await fetchWithAuth('/api/objects/upload', {
      method: 'POST',
      body: uploadFormData
    });
    
    if (!uploadRes.ok) throw new Error("Failed to upload media to storage");
    const uploadData = await uploadRes.json();
    return uploadData.filename;
  };

  const handleSave = async () => {
    // Wrapping in async function for logic
    try {
      let finalFilename = formData.filename;
      let finalAccountId = formData.socialAccountId;

      // Handle Instagram Ingest Upload - REMOVED (Already downloaded)
      // if (ingestMode === 'instagram' && ingestedData && !finalFilename) { ... }
      
      if (!finalFilename && isNewVideo) {
         toast({ title: "Error", description: "No media file provided.", variant: "destructive" });
         return;
      }
      
      // Create Account if needed
      if (selectedAccountId === "new") {
        try {
           // Avatar already handled by backend ingest (local filename provided)
           // Just verifying path is correct
           
           const accRes = await createAccountMutation.mutateAsync(newAccount);
           finalAccountId = accRes.id;
        } catch (e) {
           // Error handled in mutation onError?
           return; 
        }
      }

      setUploadStatus('finalizing');

      const payload = {
        filename: finalFilename,
        socialAccountId: finalAccountId,
        caption: formData.caption,
        likes: formData.likes || 0,
        comments: formData.comments || 0,
        shares: formData.shares || 0,
        song: formData.song || 'Original Audio',
        description: formData.description || '',
      };

      if (isNewVideo) {
        await createVideoMutation.mutateAsync(payload);
      } else {
        await updateVideoMutation.mutateAsync({ id: initialVideo.id, data: payload });
      }
      
      setUploadStatus('done');
      
    } catch (e: any) {
      setUploadStatus('idle');
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isNewVideo ? 'Add Media' : 'Edit Media'}</DialogTitle>
          <DialogDescription>
            {isNewVideo ? 'Add new media to the feed.' : 'Update the media details displayed to participants.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
                <div className="flex items-center justify-between">
                    <Label>Media Source</Label>
                    <Tabs value={ingestMode} onValueChange={(v) => setIngestMode(v as any)} className="w-[200px]">
                    <TabsList className="grid w-full grid-cols-2 h-7">
                        <TabsTrigger value="upload" className="text-xs h-6">Upload</TabsTrigger>
                        <TabsTrigger value="instagram" className="text-xs h-6">Instagram</TabsTrigger>
                    </TabsList>
                    </Tabs>
                </div>

                {ingestMode === 'instagram' ? (
                    <div className="space-y-2">
                    <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                        <Label className="text-xs">Instagram Post URL</Label>
                        <div className="flex gap-2">
                            <Input 
                                value={ingestUrl} 
                                onChange={e => setIngestUrl(e.target.value)} 
                                placeholder="https://www.instagram.com/p/..." 
                                className="h-9"
                                data-testid="input-instagram-url"
                            />
                            <Button 
                                size="sm" 
                                onClick={() => ingestInstagramMutation.mutate({ url: ingestUrl })}
                                disabled={!ingestUrl || ingestInstagramMutation.isPending}
                                data-testid="button-ingest"
                            >
                                {ingestInstagramMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Import'}
                            </Button>
                        </div>
                    </div>
                    {/* Preview for Instagram Mode */}
                    {ingestedData && (
                        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                            <div className="w-16 h-24 rounded overflow-hidden bg-gray-200 shrink-0">
                                <img src={`/media/${ingestedData.filename}`} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-sm text-blue-600">
                                    <CheckCircle2 size={16} />
                                    <span>Ready to import</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">@{ingestedData.author.username}</p>
                            </div>
                        </div>
                    )}
                    </div>
                ) : (
                <div className="space-y-3">
                {formData.filename ? ( // Changed from video.url
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                    <div className="w-16 h-24 rounded overflow-hidden bg-gray-200 shrink-0">
                        {/* Files are stored flat in uploads directory, served via /media/{filename} */}
                        <img src={`/media/${formData.filename}`} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 size={16} />
                        <span>{isNewVideo ? 'File uploaded successfully' : 'Current media'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{formData.filename}</p> {/* Changed from video.url */}
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                            setFormData(prev => ({ ...prev, filename: '' })); // Changed from url
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
                    mode="inline"
                    maxNumberOfFiles={1}
                    maxFileSize={104857600}
                    allowedFileTypes={['image/*', 'video/*']}
                    onComplete={(result) => {
                        console.log("Media Upload onComplete:", result);
                        if (result.successful && result.successful.length > 0) {
                        const responseBody = result.successful[0].response?.body as any;
                        const uploadURL = responseBody?.filename; // Use 'filename' from storage response, not 'url'
                        
                        if (uploadURL) {
                            setFormData(prev => ({ ...prev, filename: uploadURL })); // Changed from url
                            setUploadStatus('done');
                        } else {
                            setUploadStatus('idle');
                            toast({ title: 'Upload failed', description: 'No filename returned.', variant: 'destructive' });
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
                )}
            </div>

            <div className="grid gap-2">
                <Label>Author Account</Label>
                <Select 
                value={selectedAccountId} 
                onValueChange={(val) => {
                    setSelectedAccountId(val);
                    if (val !== "new") {
                        setFormData(prev => ({
                            ...prev,
                            socialAccountId: val
                        }));
                    } else {
                        setFormData(prev => ({
                            ...prev,
                            socialAccountId: '' // Clear socialAccountId if creating new
                        }));
                    }
                }}
                >
                <SelectTrigger data-testid="select-account">
                    <SelectValue placeholder="Select an account" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="new">+ Create New Account</SelectItem>
                    {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-200">
                                <img src={getProxiedUrl(acc.avatarUrl)} className="w-full h-full object-cover" />
                            </div>
                            <span>{acc.displayName} (@{acc.username})</span>
                        </div>
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>

                {selectedAccountId === "new" && (
                    <div className="p-3 border rounded-md bg-muted/30 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Display Name</Label>
                                <Input 
                                    value={newAccount.displayName} 
                                    onChange={e => setNewAccount({...newAccount, displayName: e.target.value})}
                                    placeholder="Jane Doe"
                                    className="h-8 text-sm"
                                    data-testid="input-new-account-name"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Username</Label>
                                <Input 
                                    value={newAccount.username} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        setNewAccount({...newAccount, username: val});
                                    }}
                                    placeholder="janedoe"
                                    className="h-8 text-sm"
                                    data-testid="input-new-account-username"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                            <Label className="text-xs">Avatar Source</Label>
                            <Tabs value={avatarMode} onValueChange={(v) => setAvatarMode(v as any)} className="w-[140px]">
                                <TabsList className="grid w-full grid-cols-2 h-6">
                                    <TabsTrigger value="url" className="text-[10px] h-5 px-1">Generate</TabsTrigger>
                                    <TabsTrigger value="upload" className="text-[10px] h-5 px-1">Upload</TabsTrigger>
                                </TabsList>
                            </Tabs>
                            </div>
                            
                            {avatarMode === 'url' ? (
                                <div className="flex gap-2">
                                    <Input 
                                        value={newAccount.avatarUrl} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            setNewAccount({...newAccount, avatarUrl: val});
                                        }}
                                        placeholder="https://..."
                                        className="h-8 text-sm flex-1"
                                        data-testid="input-new-account-avatar"
                                    />
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-8 w-8 p-0"
                                        title="Generate Random Avatar"
                                        type="button"
                                        onClick={() => {
                                            const seed = Math.random().toString(36).substring(7);
                                            const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${newAccount.username || seed}`;
                                            setNewAccount({...newAccount, avatarUrl: url});
                                        }}
                                    >
                                        <Sparkles size={14} />
                                    </Button>
                                </div>
                            ) : (
                                <div className="border rounded-md p-2 bg-background">
                                    {newAccount.avatarUrl ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100">
                                                <img src={getProxiedUrl(newAccount.avatarUrl)} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] truncate">{newAccount.avatarUrl.split('/').pop()}</p>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setNewAccount({...newAccount, avatarUrl: ''})}>
                                                <XCircle size={14} />
                                            </Button>
                                        </div>
                                    ) : (
                                    <ObjectUploader
                                        maxNumberOfFiles={1}
                                        maxFileSize={5242880} // 5MB for avatars
                                        allowedFileTypes={['image/*']}
                                        onComplete={(result) => {
                                            if (result.successful && result.successful.length > 0) {
                                            const responseBody = result.successful[0].response?.body as any;
                                            const uploadURL = responseBody?.url;
                                            if (uploadURL) {
                                                setNewAccount(prev => ({ ...prev, avatarUrl: uploadURL }));
                                            }
                                            }
                                        }}
                                        buttonClassName="w-full h-16 border-dashed"
                                        >
                                        <div className="flex flex-col items-center gap-1">
                                            <Upload size={16} className="text-muted-foreground" />
                                            <span className="text-[10px]">Upload Avatar</span>
                                        </div>
                                        </ObjectUploader>
                                    )}
                                </div>
                            )}
                        </div>
                        {accountError && (
                        <div className="text-destructive text-xs p-2 bg-destructive/10 rounded flex items-center gap-2">
                            <AlertCircle size={14} />
                            <span>{accountError}</span>
                        </div>
                        )}
                        {/* Only show "Save Account" button if NOT in Instagram mode? No, always helpful to create account explicitly?
                        Actually if we are creating video, we do it in one go?
                        The createAccountMutation is independent.
                        Let's keep it but maybe hide if we are auto-handling in handleSave?
                        Actually handleSave calls createAccountMutation if needed!
                        So we can hide this button in general or keep it for manual?
                        Let's keep it for manual creation but `handleSave` creates it too.
                        Wait, `handleSave` calls `createAccountMutation.mutateAsync`.
                        So we don't need user to click "Save Account" separately.
                        */}
                    </div>
                )}
            </div>
            {/* Filename Input - Read Only or Editable? For now Editable but logic is tricky */}
            {ingestMode === 'upload' && (
                <div className="grid gap-2">
                <Label htmlFor="filename">Filename</Label>
                <Input
                    id="filename"
                    value={formData.filename}
                    onChange={(e) => setFormData({ ...formData, filename: e.target.value })}
                    placeholder="uuid.mp4"
                    disabled={true}
                    className="bg-muted"
                />
                </div>
            )}

            {/* Social Account ID - For now text input, ideally a selector */}
            {/* HIDDEN, handled via Select */}
            <div className="grid gap-2">
                <Label htmlFor="video-caption">Caption</Label>
                <Input 
                id="video-caption" 
                value={formData.caption} 
                onChange={(e) => setFormData(prev => ({ ...prev, caption: e.target.value }))} 
                placeholder="Media caption..."
                data-testid="input-video-caption"
                />
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                <Label htmlFor="video-likes">Likes</Label>
                <Input 
                    id="video-likes" 
                    type="number" 
                    value={formData.likes} 
                    onChange={(e) => setFormData(prev => ({ ...prev, likes: parseInt(e.target.value) || 0 }))} 
                    data-testid="input-video-likes"
                />
                </div>
                <div className="grid gap-2">
                <Label htmlFor="video-comments">Comments</Label>
                <Input 
                    id="video-comments" 
                    type="number" 
                    value={formData.comments || 0} 
                    onChange={(e) => setFormData(prev => ({ ...prev, comments: parseInt(e.target.value) || 0 }))} 
                    data-testid="input-video-comments"
                />
                </div>
                <div className="grid gap-2">
                <Label htmlFor="video-shares">Shares</Label>
                <Input 
                    id="video-shares" 
                    type="number" 
                    value={formData.shares || 0} 
                    onChange={(e) => setFormData(prev => ({ ...prev, shares: parseInt(e.target.value) || 0 }))} 
                    data-testid="input-video-shares"
                />
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-edit-media"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isNewVideo ? createVideoMutation.isPending : updateVideoMutation.isPending}
            data-testid="button-save-media"
          >
            {isNewVideo 
              ? (createVideoMutation.isPending ? 'Adding...' : 'Add Media')
              : (updateVideoMutation.isPending ? 'Saving...' : 'Save Changes')
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Carousel Dialog Removed */}
    </>
  );
}
