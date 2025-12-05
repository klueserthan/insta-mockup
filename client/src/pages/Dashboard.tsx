import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { INITIAL_VIDEOS, type Video } from '@/lib/mockData';
import { Plus, Copy, Share2, BarChart3, ExternalLink, Trash2, Eye, PenSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const [videos, setVideos] = useState<Video[]>(INITIAL_VIDEOS);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);

  // Form states
  const [caption, setCaption] = useState('');
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState(0);
  const [shares, setShares] = useState(0);

  const handleLogout = () => {
    setLocation('/');
  };

  const copyPublicLink = () => {
    const url = `${window.location.origin}/feed?participantId=test_subject_1`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: "Public experiment URL copied to clipboard.",
    });
  };

  const openPreviewFeed = () => {
    window.open(`${window.location.origin}/feed?participantId=researcher_preview`, '_blank');
  };

  const handleOpenDialog = (video?: Video) => {
    if (video) {
      setEditingVideo(video);
      setCaption(video.caption);
      setLikes(video.likes);
      setComments(video.comments);
      setShares(video.shares);
    } else {
      setEditingVideo(null);
      setCaption('');
      setLikes(0);
      setComments(0);
      setShares(0);
    }
    setIsDialogOpen(true);
  };

  const handleSaveVideo = () => {
    if (editingVideo) {
      // Update existing video
      setVideos(videos.map(v => v.id === editingVideo.id ? {
        ...v,
        caption,
        likes,
        comments,
        shares
      } : v));
      toast({ title: "Video Updated", description: "Metadata changes saved." });
    } else {
      // Add new video (mock)
      toast({ title: "Simulated Upload", description: "Video added to feed (mock)." });
    }
    setIsDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 font-sans">
      {/* Header */}
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
              Logged in as <span className="font-medium text-foreground">Dr. Researcher</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Participants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,248</div>
              <p className="text-xs text-muted-foreground mt-1">+12% from last week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Engagement Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4.3%</div>
              <p className="text-xs text-muted-foreground mt-1">Based on likes & comments</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. View Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8.2s</div>
              <p className="text-xs text-muted-foreground mt-1">Per video impression</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Experiment Management</h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openPreviewFeed} className="gap-2">
              <Eye size={16} /> Preview Feed
            </Button>
            <Button variant="outline" onClick={copyPublicLink} className="gap-2">
              <Share2 size={16} /> Share Link
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-[#E4405F] hover:bg-[#D03050] text-white border-0" onClick={() => handleOpenDialog()}>
                  <Plus size={16} /> Add Video
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingVideo ? 'Edit Video Metadata' : 'Add New Stimulus Video'}</DialogTitle>
                  <DialogDescription>
                    {editingVideo ? 'Modify the engagement metrics and caption for this video.' : 'Upload a video or provide a URL to add to the experiment feed.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="caption">Caption</Label>
                    <Input 
                      id="caption" 
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Enter video caption with hashtags..." 
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="likes">Initial Likes</Label>
                      <Input 
                        id="likes" 
                        type="number" 
                        value={likes}
                        onChange={(e) => setLikes(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="comments">Comments</Label>
                      <Input 
                        id="comments" 
                        type="number" 
                        value={comments}
                        onChange={(e) => setComments(parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="shares">Shares</Label>
                      <Input 
                        id="shares" 
                        type="number" 
                        value={shares}
                        onChange={(e) => setShares(parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  {!editingVideo && (
                    <div className="grid gap-2">
                      <Label>Upload File</Label>
                      <div className="border-2 border-dashed rounded-md p-8 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                        <span className="text-sm">Drag & drop video file here</span>
                        <span className="text-xs mt-1 opacity-70">or click to browse</span>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" onClick={handleSaveVideo}>
                    {editingVideo ? 'Save Changes' : 'Add to Feed'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Feed Content</CardTitle>
            <CardDescription>
              Manage the videos currently visible to study participants.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Thumbnail</TableHead>
                  <TableHead>Caption</TableHead>
                  <TableHead>Metrics</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((video) => (
                  <TableRow 
                    key={video.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleOpenDialog(video)}
                  >
                    <TableCell>
                      <div className="w-12 h-20 rounded bg-gray-200 overflow-hidden">
                        <img src={video.url} alt="Thumbnail" className="w-full h-full object-cover" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="max-w-[300px] truncate">{video.caption}</div>
                      <div className="text-xs text-muted-foreground mt-1">@{video.username}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-3 text-sm text-muted-foreground">
                        <span>❤️ {video.likes.toLocaleString()}</span>
                        <span>💬 {video.comments.toLocaleString()}</span>
                        <span>↗️ {video.shares.toLocaleString()}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => handleOpenDialog(video)}>
                          <PenSquare size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" title="Remove">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
