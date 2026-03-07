# YouTube Automation Tool - সেটআপ গাইড

## প্রজেক্ট স্ট্রাকচার

```
youtube-automation/
├── backend/                 # Express.js + TypeScript API
│   ├── src/
│   │   ├── entities/       # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   └── server.ts       # Entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # React + TypeScript + Tailwind
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── store/          # Zustand state management
│   │   ├── utils/          # API utilities
│   │   └── App.tsx         # Main app
│   ├── package.json
│   └── vite.config.ts
├── railway.json            # Railway deployment config
├── Procfile               # Railway process file
└── README.md
```

## দ্রুত সেটআপ (Quick Start)

### ধাপ ১: ডিপেন্ডেন্সি ইনস্টল

```bash
cd /mnt/okcomputer/output/youtube-automation

# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### ধাপ ২: এনভায়রনমেন্ট সেটআপ

```bash
# Backend এনভায়রনমেন্ট
cd backend
cp .env.example .env

# .env ফাইলে এডিট করুন:
# - GEMINI_API_KEY (https://makersuite.google.com/app/apikey থেকে পাবেন)
# - YOUTUBE_CLIENT_ID (Google Cloud Console থেকে)
# - YOUTUBE_CLIENT_SECRET
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
```

### ধাপ ৩: ডেভেলপমেন্ট চালু করুন

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## API কী সংগ্রহ গাইড

### ১. Gemini API Key

1. https://makersuite.google.com/app/apikey এ যান
2. "Create API Key" ক্লিক করুন
3. কপি করে backend/.env-তে পেস্ট করুন

### ২. YouTube OAuth Credentials

1. https://console.cloud.google.com/ এ যান
2. নতুন প্রজেক্ট তৈরি করুন
3. APIs & Services > Credentials
4. Create Credentials > OAuth 2.0 Client ID
5. Application type: Web application
6. Authorized redirect URIs:
   - `http://localhost:3000/api/upload/youtube/callback` (local)
   - `https://your-app.up.railway.app/api/upload/youtube/callback` (production)

### ৩. Google Drive OAuth

1. Google Cloud Console-এ যান
2. APIs & Services > Enable APIs > Google Drive API
3. Credentials > Create Credentials > OAuth 2.0 Client ID
4. Scopes: `https://www.googleapis.com/auth/drive.file`

## Railway-তে ডেপ্লয়

### ধাপ ১: Railway CLI ইনস্টল

```bash
npm install -g @railway/cli
railway login
```

### ধাপ ২: প্রজেক্ট তৈরি

```bash
cd /mnt/okcomputer/output/youtube-automation
railway init
```

### ধাপ ৩: ভেরিয়েবল সেট করুন

```bash
railway variables set GEMINI_API_KEY="your_key"
railway variables set YOUTUBE_CLIENT_ID="your_id"
railway variables set YOUTUBE_CLIENT_SECRET="your_secret"
railway variables set YOUTUBE_REDIRECT_URI="https://your-app.up.railway.app/api/upload/youtube/callback"
```

### ধাপ ৪: ডেপ্লয়

```bash
railway up
```

## মূল ফিচারসমূহ

### ১. ভিডিও ডাউনলোড
- ✅ TikTok, YouTube, Instagram, Facebook সাপোর্ট
- ✅ বাল্ক ডাউনলোড (৩০-৪০ ভিডিও একসাথে)
- ✅ অটো মিউট
- ✅ প্রিভিউ দেখুন

### ২. অডিও ম্যানেজমেন্ট
- ✅ লোকাল ফাইল আপলোড
- ✅ YouTube Shorts থেকে অডিও ডাউনলোড
- ✅ ক্যাটাগরি অনুযায়ী সংগঠন
- ✅ প্লেব্যাক প্রিভিউ

### ৩. AI কন্টেন্ট
- ✅ বাংলা/ইংরেজি টাইটেল
- ✅ SEO-অপটিমাইজড ডেসক্রিপশন
- ✅ রিলেভান্ট ট্যাগস
- ✅ ট্রেন্ডিং হ্যাশট্যাগস

### ৪. আপলোড অপশন
- ✅ সরাসরি ইউটিউবে আপলোড
- ✅ YouTube Shorts
- ✅ বাল্ক আপলোড
- ✅ Google Drive জিপ আপলোড

### ৫. শিডিউলিং
- ✅ নির্দিষ্ট সময়ে আপলোড
- ✅ প্রতিদিন ১২টা, ৮টা অটো আপলোড
- ✅ রিকারিং শিডিউল

## মোবাইল অপ্টিমাইজেশন

- 📱 টাচ-ফ্রেন্ডলি UI
- 📱 রেসপনসিভ ডিজাইন
- 📱 ফাস্ট লোডিং
- 📱 সহজ নেভিগেশন

## API এন্ডপয়েন্টস

### ভিডিও
```
POST /api/videos/download
POST /api/videos/download/bulk
GET  /api/videos
POST /api/videos/:id/mute
POST /api/videos/:id/merge
```

### অডিও
```
POST /api/audio/upload
POST /api/audio/download
GET  /api/audio
```

### আপলোড
```
GET  /api/upload/youtube/auth
POST /api/upload/youtube/:id
POST /api/upload/drive/:id
POST /api/upload/drive/zip
```

### AI
```
POST /api/ai/generate
GET  /api/ai/config
```

### শিডিউল
```
POST /api/schedule
GET  /api/schedule
```

## ট্রাবলশুটিং

### সমস্যা: ভিডিও ডাউনলোড হচ্ছে না
সমাধান:
```bash
cd backend
npx yt-dlp-wrap update
```

### সমস্যা: FFmpeg এরর
সমাধান:
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg
```

### সমস্যা: YouTube OAuth কাজ করছে না
সমাধান:
1. Google Cloud Console-ে যান
2. Authorized redirect URIs চেক করুন
3. Production URL যোগ করুন

## সাপোর্ট

প্রশ্ন থাকলে বা সমস্যা হলে GitHub Issues-এ জানান।

---

**Happy Content Creating! 🎬**
