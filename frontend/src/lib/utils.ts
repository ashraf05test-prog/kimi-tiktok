import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || isNaN(bytes)) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  return date.toLocaleString('bn-BD', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-gray-500',
    downloading: 'bg-blue-500',
    downloaded: 'bg-green-500',
    processing: 'bg-yellow-500',
    ready: 'bg-emerald-500',
    uploading: 'bg-purple-500',
    uploaded: 'bg-green-600',
    failed: 'bg-red-500',
    scheduled: 'bg-indigo-500',
    active: 'bg-green-500',
    paused: 'bg-orange-500',
    completed: 'bg-green-600',
  };
  
  return colors[status] || 'bg-gray-500';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'অপেক্ষমান',
    downloading: 'ডাউনলোড হচ্ছে',
    downloaded: 'ডাউনলোড সম্পন্ন',
    processing: 'প্রসেসিং',
    ready: 'প্রস্তুত',
    uploading: 'আপলোড হচ্ছে',
    uploaded: 'আপলোড সম্পন্ন',
    failed: 'ব্যর্থ',
    scheduled: 'শিডিউল করা হয়েছে',
    active: 'সক্রিয়',
    paused: 'বিরতি',
    completed: 'সম্পন্ন',
  };
  
  return labels[status] || status;
}

export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isYoutubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
}

export function isTiktokUrl(url: string): boolean {
  return /tiktok\.com/.test(url);
}

export function getPlatformFromUrl(url: string): string {
  if (isYoutubeUrl(url)) return 'youtube';
  if (isTiktokUrl(url)) return 'tiktok';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/facebook\.com/.test(url)) return 'facebook';
  return 'unknown';
}
