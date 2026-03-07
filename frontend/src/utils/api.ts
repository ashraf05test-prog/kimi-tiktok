import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Video API
export const videoApi = {
  download: (url: string, mute = true, quality = 'medium') =>
    api.post('/videos/download', { url, mute, quality }),
  
  downloadBulk: (urls: string[], mute = true, quality = 'medium') =>
    api.post('/videos/download/bulk', { urls, mute, quality }),
  
  getInfo: (url: string) =>
    api.post('/videos/info', { url }),
  
  getAll: (status?: string) =>
    api.get('/videos', { params: { status } }),
  
  getById: (id: string) =>
    api.get(`/videos/${id}`),
  
  mute: (id: string) =>
    api.post(`/videos/${id}/mute`),
  
  merge: (id: string, audioId: string, loop = false, fade = false) =>
    api.post(`/videos/${id}/merge`, { audioId, loop, fade }),
  
  autoMerge: (id: string, category?: string) =>
    api.post(`/videos/${id}/auto-merge`, { category }),
  
  update: (id: string, updates: any) =>
    api.patch(`/videos/${id}`, updates),
  
  delete: (id: string) =>
    api.delete(`/videos/${id}`),
  
  createZip: (videoIds: string[]) =>
    api.post('/videos/zip', { videoIds }),
};

// Audio API
export const audioApi = {
  upload: (file: File, name?: string) => {
    const formData = new FormData();
    formData.append('audio', file);
    if (name) formData.append('name', name);
    
    return api.post('/audio/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  download: (url: string, name?: string) =>
    api.post('/audio/download', { url, name }),
  
  extract: (videoId: string, name?: string) =>
    api.post(`/audio/extract/${videoId}`, { name }),
  
  getAll: () =>
    api.get('/audio'),
  
  getById: (id: string) =>
    api.get(`/audio/${id}`),
  
  getRandom: (category?: string) =>
    api.get(category ? `/audio/random/${category}` : '/audio/random'),
  
  update: (id: string, updates: any) =>
    api.patch(`/audio/${id}`, updates),
  
  delete: (id: string) =>
    api.delete(`/audio/${id}`),
};

// Upload API (YouTube & Google Drive)
export const uploadApi = {
  // YouTube
  getYoutubeAuthUrl: () =>
    api.get('/upload/youtube/auth'),
  
  getYoutubeStatus: () =>
    api.get('/upload/youtube/status'),
  
  uploadToYoutube: (videoId: string, options: any) =>
    api.post(`/upload/youtube/${videoId}`, options),
  
  uploadShort: (videoId: string, options: any) =>
    api.post(`/upload/youtube/${videoId}/short`, options),
  
  uploadBulk: (videoIds: string[], type: 'video' | 'short', options: any) =>
    api.post(`/upload/youtube/bulk/${type}`, { videoIds, options }),
  
  getUploadStatus: (videoId: string) =>
    api.get(`/upload/youtube/status/${videoId}`),
  
  getChannelStats: () =>
    api.get('/upload/youtube/channel/stats'),
  
  revokeYoutube: () =>
    api.post('/upload/youtube/revoke'),
  
  // Google Drive
  getDriveAuthUrl: () =>
    api.get('/upload/drive/auth'),
  
  getDriveStatus: () =>
    api.get('/upload/drive/status'),
  
  uploadToDrive: (videoId: string, folderId?: string) =>
    api.post(`/upload/drive/${videoId}`, { folderId }),
  
  uploadZipToDrive: (videoIds: string[], zipName?: string, folderId?: string) =>
    api.post('/upload/drive/zip', { videoIds, zipName, folderId }),
  
  createDriveFolder: (folderName: string, parentFolderId?: string) =>
    api.post('/upload/drive/folder', { folderName, parentFolderId }),
  
  listDriveFiles: (folderId?: string, pageSize?: number) =>
    api.get('/upload/drive/files', { params: { folderId, pageSize } }),
  
  getDriveStorage: () =>
    api.get('/upload/drive/storage'),
  
  deleteDriveFile: (fileId: string) =>
    api.delete(`/upload/drive/${fileId}`),
  
  revokeDrive: () =>
    api.post('/upload/drive/revoke'),
};

// Schedule API
export const scheduleApi = {
  create: (videoId: string, scheduledTime: string, options: any) =>
    api.post('/schedule', { videoId, scheduledTime, ...options }),
  
  createBulk: (videoIds: string[], times: string[], options: any) =>
    api.post('/schedule/bulk', { videoIds, times, ...options }),
  
  getAll: (status?: string) =>
    api.get('/schedule', { params: { status } }),
  
  getById: (id: string) =>
    api.get(`/schedule/${id}`),
  
  update: (id: string, updates: any) =>
    api.patch(`/schedule/${id}`, updates),
  
  delete: (id: string) =>
    api.delete(`/schedule/${id}`),
  
  pause: (id: string) =>
    api.post(`/schedule/${id}/pause`),
  
  resume: (id: string) =>
    api.post(`/schedule/${id}/resume`),
  
  getUpcoming: (limit?: number) =>
    api.get('/schedule/upcoming/list', { params: { limit } }),
  
  getStats: () =>
    api.get('/schedule/stats/overview'),
};

// AI API
export const aiApi = {
  generate: (videoTitle: string, videoDescription?: string, category?: string, language?: string) =>
    api.post('/ai/generate', { videoTitle, videoDescription, category, language }),
  
  analyze: (videoInfo: any) =>
    api.post('/ai/analyze', { videoInfo }),
  
  getConfig: () =>
    api.get('/ai/config'),
  
  updateConfig: (updates: any) =>
    api.patch('/ai/config', updates),
  
  test: () =>
    api.get('/ai/test'),
};

// Settings API
export const settingsApi = {
  get: () =>
    api.get('/settings'),
  
  update: (updates: any) =>
    api.patch('/settings', updates),
  
  updateApiKeys: (geminiApiKey?: string, grokApiKey?: string) =>
    api.post('/settings/api-keys', { geminiApiKey, grokApiKey }),
  
  reset: () =>
    api.post('/settings/reset'),
};

export default api;
