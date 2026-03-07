import { useState } from 'react';
import { Video, Audio } from '@/types';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { 
  Play, 
  Pause, 
  VolumeX, 
  Music, 
  Upload, 
  Trash2, 
  Check,
  Loader2,
  Youtube,
  Clock
} from 'lucide-react';
import { formatDuration, formatFileSize, getStatusColor, getStatusLabel, truncateText } from '@/lib/utils';

interface VideoCardProps {
  video: Video;
  audios: Audio[];
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  onMerge?: (audioId: string) => void;
  onUpload?: () => void;
  onSchedule?: () => void;
}

export function VideoCard({ 
  video, 
  audios, 
  isSelected, 
  onSelect, 
  onDelete, 
  onMerge, 
  onUpload,
  onSchedule 
}: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState('');
  const [showAudioSelect, setShowAudioSelect] = useState(false);

  const isProcessing = video.status === 'downloading' || video.status === 'processing' || video.status === 'uploading';
  const isReady = video.status === 'ready' || video.status === 'downloaded';
  const isUploaded = video.status === 'uploaded';

  return (
    <Card className={`overflow-hidden transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      {/* Video Preview */}
      <div className="relative aspect-[9/16] bg-black">
        {video.processedPath || video.localPath ? (
          <video
            src={`${video.processedPath || video.localPath}`}
            className="h-full w-full object-contain"
            muted={video.isMuted}
            loop
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/50">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {/* Overlay Controls */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const videoEl = e.currentTarget.parentElement?.querySelector('video');
              if (videoEl) {
                if (isPlaying) {
                  videoEl.pause();
                } else {
                  videoEl.play();
                }
              }
            }}
            className="rounded-full bg-white/20 p-3 backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            {isPlaying ? <Pause className="h-6 w-6 text-white" /> : <Play className="h-6 w-6 text-white" />}
          </button>
        </div>

        {/* Status Badge */}
        <div className="absolute left-2 top-2">
          <Badge 
            variant={isUploaded ? 'success' : isReady ? 'default' : 'secondary'}
            className="text-xs"
          >
            {isProcessing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {getStatusLabel(video.status)}
          </Badge>
        </div>

        {/* Mute Indicator */}
        {video.isMuted && (
          <div className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5">
            <VolumeX className="h-4 w-4 text-white" />
          </div>
        )}

        {/* Selection Checkbox */}
        <div className="absolute left-2 bottom-2">
          <button
            onClick={onSelect}
            className={`rounded-full p-2 transition-colors ${
              isSelected ? 'bg-primary text-white' : 'bg-black/50 text-white/70'
            }`}
          >
            {isSelected ? <Check className="h-4 w-4" /> : <div className="h-4 w-4 rounded-sm border-2" />}
          </button>
        </div>

        {/* Duration */}
        {video.metadata?.duration && (
          <div className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
            {formatDuration(video.metadata.duration)}
          </div>
        )}
      </div>

      {/* Video Info */}
      <CardContent className="p-3">
        <h3 className="mb-1 line-clamp-2 text-sm font-medium">
          {truncateText(video.title || 'Untitled', 50)}
        </h3>
        
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          {video.metadata?.size && (
            <span>{formatFileSize(video.metadata.size)}</span>
          )}
          {video.metadata?.width && video.metadata?.height && (
            <span>{video.metadata.width}x{video.metadata.height}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5">
          {/* Audio Selection */}
          {isReady && !video.audioId && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => setShowAudioSelect(!showAudioSelect)}
              >
                <Music className="mr-1 h-3 w-3" />
                অডিও
              </Button>
            </>
          )}

          {/* Upload Button */}
          {isReady && (
            <Button
              size="sm"
              variant="default"
              className="flex-1 text-xs"
              onClick={onUpload}
              disabled={isProcessing}
            >
              <Youtube className="mr-1 h-3 w-3" />
              আপলোড
            </Button>
          )}

          {/* Schedule Button */}
          {isReady && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={onSchedule}
            >
              <Clock className="mr-1 h-3 w-3" />
              শিডিউল
            </Button>
          )}

          {/* Delete Button */}
          <Button
            size="sm"
            variant="destructive"
            className="px-2"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Audio Selection Dropdown */}
        {showAudioSelect && (
          <div className="mt-2 space-y-2">
            <select
              value={selectedAudio}
              onChange={(e) => setSelectedAudio(e.target.value)}
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"
            >
              <option value="">অডিও নির্বাচন করুন</option>
              {audios.map((audio) => (
                <option key={audio.id} value={audio.id}>
                  {audio.name} ({formatDuration(audio.duration)})
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              <Button
                size="sm"
                className="flex-1 text-xs"
                onClick={() => {
                  if (selectedAudio) {
                    onMerge?.(selectedAudio);
                    setShowAudioSelect(false);
                  }
                }}
                disabled={!selectedAudio}
              >
                যোগ করুন
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setShowAudioSelect(false)}
              >
                বাতিল
              </Button>
            </div>
          </div>
        )}

        {/* AI Generated Content Preview */}
        {video.aiGenerated?.title && (
          <div className="mt-2 rounded bg-muted p-2 text-xs">
            <p className="font-medium text-primary">AI শিরোনাম:</p>
            <p className="text-muted-foreground">{truncateText(video.aiGenerated.title, 60)}</p>
          </div>
        )}

        {/* YouTube Link */}
        {video.uploadInfo?.youtubeVideoId && (
          <a
            href={`https://youtube.com/shorts/${video.uploadInfo.youtubeVideoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:underline"
          >
            <Youtube className="h-3 w-3" />
            ইউটিউবে দেখুন
          </a>
        )}
      </CardContent>
    </Card>
  );
}
