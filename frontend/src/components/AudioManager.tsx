import { useState, useRef } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { audioApi } from '@/utils/api';
import { useStore } from '@/store';
import { Audio } from '@/types';
import { 
  Upload, 
  Link2, 
  Music, 
  Trash2, 
  Play, 
  Pause,
  Heart,
  Loader2,
  Download
} from 'lucide-react';
import { formatDuration } from '@/lib/utils';

interface AudioManagerProps {
  audios: Audio[];
  onRefresh: () => void;
}

export function AudioManager({ audios, onRefresh }: AudioManagerProps) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const { addNotification } = useStore();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await audioApi.upload(file, file.name.replace(/\.[^/.]+$/, ''));
      addNotification({ type: 'success', message: 'অডিও আপলোড সম্পন্ন!' });
      onRefresh();
    } catch (error: any) {
      addNotification({ 
        type: 'error', 
        message: error.response?.data?.message || 'আপলোড ব্যর্থ হয়েছে' 
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleYoutubeDownload = async () => {
    if (!youtubeUrl.trim()) {
      addNotification({ type: 'error', message: 'YouTube URL দিন' });
      return;
    }

    setIsDownloading(true);
    try {
      await audioApi.download(youtubeUrl);
      addNotification({ type: 'success', message: 'অডিও ডাউনলোড সম্পন্ন!' });
      setYoutubeUrl('');
      onRefresh();
    } catch (error: any) {
      addNotification({ 
        type: 'error', 
        message: error.response?.data?.message || 'ডাউনলোড ব্যর্থ হয়েছে' 
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const togglePlay = (audioId: string) => {
    const audioEl = audioRefs.current.get(audioId);
    if (!audioEl) return;

    if (playingAudio === audioId) {
      audioEl.pause();
      setPlayingAudio(null);
    } else {
      // Pause any playing audio
      if (playingAudio) {
        const playingEl = audioRefs.current.get(playingAudio);
        playingEl?.pause();
      }
      audioEl.play();
      setPlayingAudio(audioId);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await audioApi.delete(id);
      addNotification({ type: 'success', message: 'অডিও মুছে ফেলা হয়েছে' });
      onRefresh();
    } catch (error: any) {
      addNotification({ type: 'error', message: 'মুছতে ব্যর্থ হয়েছে' });
    }
  };

  const toggleFavorite = async (audio: Audio) => {
    try {
      await audioApi.update(audio.id, { isFavorite: !audio.isFavorite });
      onRefresh();
    } catch (error) {
      // Silent fail
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Music className="h-5 w-5" />
          অডিও লাইব্রেরি
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Section */}
        <div className="space-y-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            className="hidden"
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            ফাইল আপলোড করুন
          </Button>
        </div>

        {/* YouTube Download */}
        <div className="flex gap-2">
          <Input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="YouTube Shorts URL..."
            className="flex-1"
          />
          <Button
            onClick={handleYoutubeDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Audio List */}
        <div className="max-h-[400px] space-y-2 overflow-y-auto">
          {audios.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              কোনো অডিও নেই
            </p>
          ) : (
            audios.map((audio) => (
              <div
                key={audio.id}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <button
                  onClick={() => togglePlay(audio.id)}
                  className="rounded-full bg-primary p-2 text-primary-foreground"
                >
                  {playingAudio === audio.id ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </button>

                <audio
                  ref={(el) => {
                    if (el) audioRefs.current.set(audio.id, el);
                  }}
                  src={`${audio.localPath}`}
                  onEnded={() => setPlayingAudio(null)}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{audio.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(audio.duration)} • {audio.category || 'সাধারণ'}
                  </p>
                </div>

                <button
                  onClick={() => toggleFavorite(audio)}
                  className={`p-1 ${audio.isFavorite ? 'text-red-500' : 'text-muted-foreground'}`}
                >
                  <Heart className={`h-4 w-4 ${audio.isFavorite ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={() => handleDelete(audio.id)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
