import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { videoApi } from '@/utils/api';
import { useStore } from '@/store';
import { Loader2, Plus, Link2, Trash2, Download } from 'lucide-react';

export function VideoDownloader() {
  const [urls, setUrls] = useState<string[]>(['']);
  const [isLoading, setIsLoading] = useState(false);
  const { addVideo, addNotification } = useStore();

  const addUrlField = () => {
    setUrls([...urls, '']);
  };

  const removeUrlField = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const handleDownload = async () => {
    const validUrls = urls.filter(url => url.trim() !== '');
    if (validUrls.length === 0) {
      addNotification({ type: 'error', message: 'অন্তত একটি URL দিন' });
      return;
    }

    setIsLoading(true);
    
    try {
      if (validUrls.length === 1) {
        const response = await videoApi.download(validUrls[0], true, 'medium');
        if (response.data.success) {
          addVideo(response.data.video);
          addNotification({ type: 'success', message: 'ভিডিও ডাউনলোড সম্পন্ন!' });
        }
      } else {
        const response = await videoApi.downloadBulk(validUrls, true, 'medium');
        if (response.data.success) {
          const successful = response.data.videos.filter((v: any) => v.success);
          successful.forEach((v: any) => addVideo(v.video));
          addNotification({ 
            type: 'success', 
            message: `${successful.length}/${validUrls.length} ভিডিও ডাউনলোড সম্পন্ন` 
          });
        }
      }
      setUrls(['']);
    } catch (error: any) {
      addNotification({ 
        type: 'error', 
        message: error.response?.data?.message || 'ডাউনলোড ব্যর্থ হয়েছে' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Download className="h-5 w-5" />
          ভিডিও ডাউনলোড করুন
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {urls.map((url, index) => (
          <div key={index} className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => updateUrl(index, e.target.value)}
                placeholder="YouTube/TikTok/Instagram URL পেস্ট করুন..."
                className="pl-10"
              />
            </div>
            {urls.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => removeUrlField(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={addUrlField}
            className="flex-1"
          >
            <Plus className="mr-2 h-4 w-4" />
            আরো URL যোগ করুন
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ডাউনলোড হচ্ছে...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                ডাউনলোড করুন
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          সাপোর্টেড: YouTube, TikTok, Instagram, Facebook
        </p>
      </CardContent>
    </Card>
  );
}
