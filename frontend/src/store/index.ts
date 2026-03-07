import { create } from 'zustand';
import { Video, Audio, Schedule, Settings, Notification, AIContent } from '@/types';

interface AppState {
  // Videos
  videos: Video[];
  currentVideo: Video | null;
  setVideos: (videos: Video[]) => void;
  addVideo: (video: Video) => void;
  updateVideo: (id: string, updates: Partial<Video>) => void;
  removeVideo: (id: string) => void;
  setCurrentVideo: (video: Video | null) => void;
  
  // Audio
  audios: Audio[];
  currentAudio: Audio | null;
  setAudios: (audios: Audio[]) => void;
  addAudio: (audio: Audio) => void;
  removeAudio: (id: string) => void;
  setCurrentAudio: (audio: Audio | null) => void;
  
  // Schedules
  schedules: Schedule[];
  setSchedules: (schedules: Schedule[]) => void;
  addSchedule: (schedule: Schedule) => void;
  updateSchedule: (id: string, updates: Partial<Schedule>) => void;
  removeSchedule: (id: string) => void;
  
  // Settings
  settings: Settings | null;
  setSettings: (settings: Settings) => void;
  
  // AI Content
  aiContent: AIContent | null;
  setAiContent: (content: AIContent | null) => void;
  
  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Processing State
  processingVideos: Set<string>;
  addProcessingVideo: (id: string) => void;
  removeProcessingVideo: (id: string) => void;
  
  // Selected Items
  selectedVideos: Set<string>;
  toggleVideoSelection: (id: string) => void;
  selectAllVideos: () => void;
  clearVideoSelection: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Videos
  videos: [],
  currentVideo: null,
  setVideos: (videos) => set({ videos }),
  addVideo: (video) => set((state) => ({ videos: [video, ...state.videos] })),
  updateVideo: (id, updates) => set((state) => ({
    videos: state.videos.map((v) => v.id === id ? { ...v, ...updates } : v),
  })),
  removeVideo: (id) => set((state) => ({
    videos: state.videos.filter((v) => v.id !== id),
  })),
  setCurrentVideo: (video) => set({ currentVideo: video }),
  
  // Audio
  audios: [],
  currentAudio: null,
  setAudios: (audios) => set({ audios }),
  addAudio: (audio) => set((state) => ({ audios: [audio, ...state.audios] })),
  removeAudio: (id) => set((state) => ({
    audios: state.audios.filter((a) => a.id !== id),
  })),
  setCurrentAudio: (audio) => set({ currentAudio: audio }),
  
  // Schedules
  schedules: [],
  setSchedules: (schedules) => set({ schedules }),
  addSchedule: (schedule) => set((state) => ({ schedules: [schedule, ...state.schedules] })),
  updateSchedule: (id, updates) => set((state) => ({
    schedules: state.schedules.map((s) => s.id === id ? { ...s, ...updates } : s),
  })),
  removeSchedule: (id) => set((state) => ({
    schedules: state.schedules.filter((s) => s.id !== id),
  })),
  
  // Settings
  settings: null,
  setSettings: (settings) => set({ settings }),
  
  // AI Content
  aiContent: null,
  setAiContent: (content) => set({ aiContent: content }),
  
  // UI State
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
  
  // Notifications
  notifications: [],
  addNotification: (notification) => set((state) => ({
    notifications: [
      { ...notification, id: Date.now().toString(), timestamp: Date.now() },
      ...state.notifications,
    ].slice(0, 10),
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
  })),
  clearNotifications: () => set({ notifications: [] }),
  
  // Processing State
  processingVideos: new Set(),
  addProcessingVideo: (id) => set((state) => ({
    processingVideos: new Set([...state.processingVideos, id]),
  })),
  removeProcessingVideo: (id) => set((state) => {
    const newSet = new Set(state.processingVideos);
    newSet.delete(id);
    return { processingVideos: newSet };
  }),
  
  // Selected Items
  selectedVideos: new Set(),
  toggleVideoSelection: (id) => set((state) => {
    const newSet = new Set(state.selectedVideos);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return { selectedVideos: newSet };
  }),
  selectAllVideos: () => set((state) => ({
    selectedVideos: new Set(state.videos.map((v) => v.id)),
  })),
  clearVideoSelection: () => set({ selectedVideos: new Set() }),
}));
