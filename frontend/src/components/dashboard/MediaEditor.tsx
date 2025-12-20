
import { useState } from 'react';
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

export function MediaEditor({ video: initialVideo, experimentId, open, onOpenChange, onSave }: MediaEditorProps) {
  const { toast } = useToast();
  const [video, setVideo] = useState<Video>(initialVideo);
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

  const isNewVideo = !video.id;

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
        setVideo(prev => ({
            ...prev,
            username: data.username,
            userAvatar: data.avatarUrl
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

  const ingestInstagramMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest('POST', '/api/instagram/ingest', { url });
      return res.json();
    },
    onSuccess: (data: any) => {
      setVideo(prev => ({
        ...prev,
        url: data.url,
        username: data.username,
        userAvatar: data.authorAvatar,
        caption: data.caption,
        likes: data.likes,
        comments: data.comments,
        shares: data.shares
      }));
      
      setNewAccount({
          username: data.username,
          displayName: data.authorName,
          avatarUrl: data.authorAvatar
      });
      setSelectedAccountId("new");
      
      toast({ title: 'Instagram Imported', description: 'Media details populated.' });
    },
    onError: (err: any) => {
        toast({ title: 'Import Failed', description: err.message, variant: 'destructive' });
    }
  });

  const handleSave = () => {
    if (isNewVideo) {
      const seed = Math.random().toString(36).substring(7);
      createVideoMutation.mutate({
        url: video.url,
        username: video.username,
        userAvatar: video.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${video.username}_${seed}`,
        caption: video.caption,
        likes: video.likes || 0,
        comments: video.comments || 0,
        shares: video.shares || 0,
        song: 'Original Audio',
      });
    } else {
      updateVideoMutation.mutate({ 
        id: video.id, 
        data: {
          url: video.url,
          username: video.username,
          caption: video.caption,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
        }
      });
    }
  };

  return (
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
                                onClick={() => ingestInstagramMutation.mutate(ingestUrl)}
                                disabled={!ingestUrl || ingestInstagramMutation.isPending}
                                data-testid="button-ingest"
                            >
                                {ingestInstagramMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Import'}
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                            Imports media, caption, metrics, and author details.
                        </p>
                    </div>
                ) : (
                <div className="space-y-3">
                {video.url ? (
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                    <div className="w-16 h-24 rounded overflow-hidden bg-gray-200 shrink-0">
                        <img src={video.url} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle2 size={16} />
                        <span>{isNewVideo ? 'File uploaded successfully' : 'Current media'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{video.url}</p>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                            setVideo(prev => ({ ...prev, url: '' }));
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
                        const uploadURL = responseBody?.url;
                        
                        if (uploadURL) {
                            setVideo(prev => ({ ...prev, url: uploadURL }));
                            setUploadStatus('done');
                        } else {
                            setUploadStatus('idle');
                            toast({ title: 'Upload failed', description: 'No URL returned.', variant: 'destructive' });
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
                        const account = accounts.find(a => a.id === val);
                        if (account) {
                            setVideo(prev => ({
                                ...prev,
                                username: account.username,
                                userAvatar: account.avatarUrl
                            }));
                        }
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
                                <img src={acc.avatarUrl} className="w-full h-full object-cover" />
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
                                        // Update preview
                                        setVideo(prev => ({...prev, username: val}));
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
                                            setVideo(prev => ({ ...prev, userAvatar: url }));
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
                                                <img src={newAccount.avatarUrl} className="w-full h-full object-cover" />
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
                        <Button 
                        size="sm" 
                        className="w-full h-8" 
                        variant="secondary"
                        type="button"
                        onClick={() => createAccountMutation.mutate(newAccount)}
                        disabled={!newAccount.username || !newAccount.displayName || !newAccount.avatarUrl || createAccountMutation.isPending}
                        data-testid="button-create-account"
                        >
                        {createAccountMutation.isPending ? 'Saving...' : 'Save Account'}
                        </Button>
                    </div>
                )}
            </div>
            <div className="grid gap-2">
                <Label htmlFor="video-caption">Caption</Label>
                <Input 
                id="video-caption" 
                value={video.caption} 
                onChange={(e) => setVideo(prev => ({ ...prev, caption: e.target.value }))} 
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
                    value={video.likes} 
                    onChange={(e) => setVideo(prev => ({ ...prev, likes: parseInt(e.target.value) || 0 }))} 
                    data-testid="input-video-likes"
                />
                </div>
                <div className="grid gap-2">
                <Label htmlFor="video-comments">Comments</Label>
                <Input 
                    id="video-comments" 
                    type="number" 
                    value={video.comments} 
                    onChange={(e) => setVideo(prev => ({ ...prev, comments: parseInt(e.target.value) || 0 }))} 
                    data-testid="input-video-comments"
                />
                </div>
                <div className="grid gap-2">
                <Label htmlFor="video-shares">Shares</Label>
                <Input 
                    id="video-shares" 
                    type="number" 
                    value={video.shares} 
                    onChange={(e) => setVideo(prev => ({ ...prev, shares: parseInt(e.target.value) || 0 }))} 
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
  );
}
