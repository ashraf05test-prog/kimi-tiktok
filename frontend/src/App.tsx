import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/Tabs';
import { VideoDownloader } from './components/VideoDownloader';
import { AudioManager } from './components/AudioManager';
import { VideoCard } from './components/VideoCard';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { useStore } from './store';
import { videoApi, audioApi, uploadApi, aiApi } from './utils/api';
import { Video, Audio } from './types';
import { 
  Youtube, 
  Music, 
  Video as VideoIcon, 
  Settings, 
  Upload, 
  Trash2, 
  Check,
  X,
  Loader2,
  FileArchive,
  Calendar
} from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/Dialog';
import { formatDate } from './lib/utils';

function App() {
  const [activeTab, setActiveTab] = useState('videos');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedVideoForUpload, setSelectedVideoForUpload] = useState<Video | null>(null);
  const [selectedVideoForSchedule, setSelectedVideoForSchedule] = useState<Video | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [aiContent, setAiContent] = useState<any>(null);

  const { 
    videos, 
    audios, 
    selectedVideos,
    setVideos, 
    setAudios, 
    addNotification,
    toggleVideoSelection,
    selectAllVideos,
    clearVideoSelection,
    removeVideo,
    updateVideo,
  } = useStore();

  // Load initial data
  useEffect(() => {
    loadVideos();
    loadAudios();
  }, []);

  const loadVideos = async () => {
    try {
      const response = await videoApi.getAll();
      setVideos(response.data.videos);
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const loadAudios = async () => {
    try {
      const response = await audioApi.getAll();
      setAudios(response.data.audio);
    } catch (error) {
      console.error('Failed to load audios:', error);
    }
  };

  const handleMerge = async (videoId: string, audioId: string) => {
    try {
      addNotification({ type: 'info', message: 'অডিও যোগ করা হচ্ছে...' });
      const response = await videoApi.merge(videoId, audioId, true);
      updateVideo(videoId, response.data.video);
      addNotification({ type: 'success', message: 'অডিও যোগ সম্পন্ন!' });
    } catch (error: any) {
      addNotification({ type: 'error', message: 'অডিও যোগ ব্যর্থ হয়েছে' });
    }
  };

  const handleUpload = async (video: Video) => {
    setSelectedVideoForUpload(video);
    setAiContent(null);
    setShowUploadDialog(true);

    // Auto-generate AI content
    setIsGeneratingAI(true);
    try {
      const response = await aiApi.generate(
        video.title || 'Video',
        video.description || '',
        'general',
        'bn'
      );
      setAiContent(response.data.content);
    } catch (error) {
      console.error('AI generation failed:', error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const confirmUpload = async () => {
    if (!selectedVideoForUpload) return;

    setIsUploading(true);
    try {
      const response = await uploadApi.uploadToYoutube(
        selectedVideoForUpload.id,
        {
          title: aiContent?.title,
          description: aiContent?.description,
          tags: aiContent?.tags,
          autoGenerateContent: !aiContent,
        }
      );
      
      updateVideo(selectedVideoForUpload.id, {
        status: 'uploaded',
        uploadInfo: {
          youtubeVideoId: response.data.result.youtubeVideoId,
          uploadDate: new Date().toISOString(),
        },
        aiGenerated: aiContent,
      });

      addNotification({ 
        type: 'success', 
        message: 'ইউটিউবে আপলোড সম্পন্ন!' 
      });
      setShowUploadDialog(false);
    } catch (error: any) {
      addNotification({ 
        type: 'error', 
        message: error.response?.data?.message || 'আপলোড ব্যর্থ হয়েছে' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSchedule = (video: Video) => {
    setSelectedVideoForSchedule(video);
    setScheduleDate('');
    setScheduleTime('');
    setShowScheduleDialog(true);
  };

  const confirmSchedule = async () => {
    if (!selectedVideoForSchedule || !scheduleDate || !scheduleTime) return;

    try {
      const scheduledTime = new Date(`${scheduleDate}T${scheduleTime}`);
      
      // Create schedule
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: selectedVideoForSchedule.id,
          scheduledTime: scheduledTime.toISOString(),
          autoGenerateContent: true,
        }),
      });

      if (response.ok) {
        addNotification({ type: 'success', message: 'শিডিউল সম্পন্ন!' });
        setShowScheduleDialog(false);
        loadVideos();
      }
    } catch (error) {
      addNotification({ type: 'error', message: 'শিডিউল ব্যর্থ হয়েছে' });
    }
  };

  const handleBulkUpload = async () => {
    if (selectedVideos.size === 0) {
      addNotification({ type: 'error', message: 'কোনো ভিডিও নির্বাচন করুন' });
      return;
    }

    const videoIds = Array.from(selectedVideos);
    addNotification({ type: 'info', message: `${videoIds.length}টি ভিডিও আপলোড হচ্ছে...` });

    try {
      await uploadApi.uploadBulk(videoIds, 'short', { autoGenerateContent: true });
      addNotification({ type: 'success', message: 'বাল্ক আপলোড সম্পন্ন!' });
      clearVideoSelection();
      loadVideos();
    } catch (error: any) {
      addNotification({ type: 'error', message: 'বাল্ক আপলোড ব্যর্থ হয়েছে' });
    }
  };

  const handleBulkDriveUpload = async () => {
    if (selectedVideos.size === 0) {
      addNotification({ type: 'error', message: 'কোনো ভিডিও নির্বাচন করুন' });
      return;
    }

    const videoIds = Array.from(selectedVideos);
    addNotification({ type: 'info', message: 'Google Drive-ে আপলোড হচ্ছে...' });

    try {
      const response = await uploadApi.uploadZipToDrive(
        videoIds,
        `videos_${new Date().toISOString().split('T')[0]}`
      );
      addNotification({ 
        type: 'success', 
        message: `Google Drive-ে জিপ আপলোড সম্পন্ন! লিংক: ${response.data.result.webLink}` 
      });
      clearVideoSelection();
    } catch (error: any) {
      addNotification({ type: 'error', message: 'Google Drive আপলোড ব্যর্থ হয়েছে' });
    }
  };

  const handleDelete = async (video: Video) => {
    try {
      await videoApi.delete(video.id);
      removeVideo(video.id);
      addNotification({ type: 'success', message: 'ভিডিও মুছে ফেলা হয়েছে' });
    } catch (error) {
      addNotification({ type: 'error', message: 'মুছতে ব্যর্থ হয়েছে' });
    }
  };

  const readyVideos = videos.filter(v => v.status === 'ready' || v.status === 'downloaded');
  const uploadedVideos = videos.filter(v => v.status === 'uploaded');

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Youtube className="h-6 w-6 text-red-600" />
            <h1 className="text-lg font-bold">YouTube Automation</h1>
          </div>
          <div className="flex items-center gap-2">
            {selectedVideos.size > 0 && (
              <Badge variant="secondary">
                {selectedVideos.size} নির্বাচিত
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 grid w-full grid-cols-3">
            <TabsTrigger value="videos">
              <VideoIcon className="mr-2 h-4 w-4" />
              ভিডিও
            </TabsTrigger>
            <TabsTrigger value="audio">
              <Music className="mr-2 h-4 w-4" />
              অডিও
            </TabsTrigger>
            <TabsTrigger value="uploaded">
              <Upload className="mr-2 h-4 w-4" />
              আপলোড করা
            </TabsTrigger>
          </TabsList>

          {/* Videos Tab */}
          <TabsContent value="videos" className="space-y-4">
            <VideoDownloader />

            {/* Bulk Actions */}
            {readyVideos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectAllVideos()}
                >
                  <Check className="mr-2 h-4 w-4" />
                  সব নির্বাচন
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearVideoSelection}
                >
                  <X className="mr-2 h-4 w-4" />
                  নির্বাচন বাতিল
                </Button>
                {selectedVideos.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      onClick={handleBulkUpload}
                    >
                      <Youtube className="mr-2 h-4 w-4" />
                      আপলোড করুন
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleBulkDriveUpload}
                    >
                      <FileArchive className="mr-2 h-4 w-4" />
                      Drive-ে জিপ
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Video Grid */}
            {readyVideos.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <VideoIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">কোনো ভিডিও নেই</p>
                <p className="text-sm text-muted-foreground">উপরে URL দিয়ে ভিডিও ডাউনলোড করুন</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {readyVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    audios={audios}
                    isSelected={selectedVideos.has(video.id)}
                    onSelect={() => toggleVideoSelection(video.id)}
                    onDelete={() => handleDelete(video)}
                    onMerge={(audioId) => handleMerge(video.id, audioId)}
                    onUpload={() => handleUpload(video)}
                    onSchedule={() => handleSchedule(video)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Audio Tab */}
          <TabsContent value="audio">
            <AudioManager audios={audios} onRefresh={loadAudios} />
          </TabsContent>

          {/* Uploaded Tab */}
          <TabsContent value="uploaded">
            {uploadedVideos.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">কোনো আপলোড করা ভিডিও নেই</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {uploadedVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    audios={audios}
                    onDelete={() => handleDelete(video)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogHeader>
          <DialogTitle>ইউটিউবে আপলোড করুন</DialogTitle>
          <DialogDescription>
            AI-জেনারেটেড কন্টেন্ট দেখুন এবং আপলোড করুন
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isGeneratingAI ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">AI কন্টেন্ট তৈরি হচ্ছে...</span>
            </div>
          ) : aiContent ? (
            <>
              <div>
                <label className="text-sm font-medium">শিরোনাম</label>
                <p className="mt-1 text-sm">{aiContent.title}</p>
              </div>
              <div>
                <label className="text-sm font-medium">বিবরণ</label>
                <p className="mt-1 max-h-32 overflow-auto text-sm text-muted-foreground">
                  {aiContent.description}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">ট্যাগস</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {aiContent.tags?.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">হ্যাশট্যাগস</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {aiContent.hashtags?.map((tag: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-muted-foreground">
              AI কন্টেন্ট তৈরি করা যায়নি। ডিফল্ট কন্টেন্ট ব্যবহার করা হবে।
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowUploadDialog(false)}
          >
            বাতিল
          </Button>
          <Button
            onClick={confirmUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                আপলোড হচ্ছে...
              </>
            ) : (
              <>
                <Youtube className="mr-2 h-4 w-4" />
                আপলোড করুন
              </>
            )}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogHeader>
          <DialogTitle>শিডিউল করুন</DialogTitle>
          <DialogDescription>
            ভিডিও আপলোডের সময় নির্বাচন করুন
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">তারিখ</label>
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">সময়</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowScheduleDialog(false)}
          >
            বাতিল
          </Button>
          <Button
            onClick={confirmSchedule}
            disabled={!scheduleDate || !scheduleTime}
          >
            <Calendar className="mr-2 h-4 w-4" />
            শিডিউল করুন
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {useStore.getState().notifications.map((notification) => (
          <div
            key={notification.id}
            className={`rounded-lg px-4 py-3 shadow-lg ${
              notification.type === 'success' ? 'bg-green-500 text-white' :
              notification.type === 'error' ? 'bg-red-500 text-white' :
              notification.type === 'warning' ? 'bg-yellow-500 text-white' :
              'bg-blue-500 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{notification.message}</span>
              <button
                onClick={() => useStore.getState().removeNotification(notification.id)}
                className="ml-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
