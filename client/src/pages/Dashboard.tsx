import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { INITIAL_VIDEOS, type Video } from '@/lib/mockData';
import { Plus, Copy, Share2, BarChart3, ExternalLink, Trash2, Eye, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps {
  video: Video;
}

function SortableRow({ video }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: isDragging ? 'relative' as const : undefined,
    backgroundColor: isDragging ? 'hsl(var(--muted))' : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} className={isDragging ? 'opacity-50' : ''}>
      <TableCell className="w-[50px]">
        <div 
          {...listeners} 
          className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded flex items-center justify-center"
          data-testid={`drag-handle-${video.id}`}
        >
          <GripVertical size={18} className="text-muted-foreground" />
        </div>
      </TableCell>
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
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" title="Preview" data-testid={`button-preview-${video.id}`}>
            <ExternalLink size={16} />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" title="Remove" data-testid={`button-delete-${video.id}`}>
            <Trash2 size={16} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function Dashboard() {
  const [videos, setVideos] = useState<Video[]>(INITIAL_VIDEOS);
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setVideos((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

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
            <Button variant="secondary" onClick={() => window.open('/feed?participantId=preview', '_blank')} className="gap-2">
              <Eye size={16} /> Preview Feed
            </Button>
            <Button variant="outline" onClick={copyPublicLink} className="gap-2">
              <Share2 size={16} /> Share Link
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-[#E4405F] hover:bg-[#D03050] text-white border-0">
                  <Plus size={16} /> Add Video
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Stimulus Video</DialogTitle>
                  <DialogDescription>
                    Upload a video or provide a URL to add to the experiment feed.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="caption">Caption</Label>
                    <Input id="caption" placeholder="Enter video caption with hashtags..." />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="likes">Initial Likes</Label>
                      <Input id="likes" type="number" defaultValue="0" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="comments">Comments</Label>
                      <Input id="comments" type="number" defaultValue="0" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="shares">Shares</Label>
                      <Input id="shares" type="number" defaultValue="0" />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Upload File</Label>
                    <div className="border-2 border-dashed rounded-md p-8 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors">
                      <span className="text-sm">Drag & drop video file here</span>
                      <span className="text-xs mt-1 opacity-70">or click to browse</span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" onClick={() => toast({ title: "Simulated Upload", description: "Video added to feed (mock)." })}>
                    Add to Feed
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
              Manage the videos currently visible to study participants. Drag rows to reorder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="w-[100px]">Thumbnail</TableHead>
                    <TableHead>Caption</TableHead>
                    <TableHead>Metrics</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={videos}
                    strategy={verticalListSortingStrategy}
                  >
                    {videos.map((video) => (
                      <SortableRow key={video.id} video={video} />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
