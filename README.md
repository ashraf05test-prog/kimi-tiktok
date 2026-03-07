# YouTube Automation Tool

একটি সম্পূর্ণ YouTube অটোমেশন টুল যা TikTok/YouTube ভিডিও ডাউনলোড, অডিও যোগ, AI-জেনারেটেড কন্টেন্ট তৈরি, এবং স্বয়ংক্রিয় আপলোড করতে পারে।

## ফিচারস

### ভিডিও ম্যানেজমেন্ট
- ✅ **বাল্ক ডাউনলোড**: একসাথে ৩০-৪০ টি TikTok/YouTube ভিডিও ডাউনলোড
- ✅ **ভিডিও প্রিভিউ**: মিউট অবস্থায় ভিডিও দেখুন
- ✅ **অডিও মার্জ**: ভিডিওতে অডিও যোগ করুন (লুপ সাপোর্ট সহ)
- ✅ **অটো মার্জ**: রেন্ডম অডিও অটোমেটিক যোগ করুন

### অডিও ম্যানেজমেন্ট
- ✅ **অডিও আপলোড**: লোকাল অডিও ফাইল আপলোড
- ✅ **YouTube থেকে ডাউনলোড**: YouTube Shorts থেকে অডিও ডাউনলোড
- ✅ **অডিও লাইব্রেরি**: ক্যাটাগরি অনুযায়ী অডিও সংগঠন
- ✅ **প্লেব্যাক**: অডিও প্রিভিউ করুন

### AI কন্টেন্ট জেনারেশন
- ✅ **শিরোনাম**: SEO-অপটিমাইজড টাইটেল (বাংলা/ইংরেজি)
- ✅ **বিবরণ**: এঙ্গেজিং ডেসক্রিপশন
- ✅ **ট্যাগস**: রিলেভান্ট ট্যাগস
- ✅ **হ্যাশট্যাগস**: ট্রেন্ডিং হ্যাশট্যাগস
- ✅ **মডেল সাপোর্ট**: Gemini / Grok

### আপলোড অপশন
- ✅ **ইউটিউব আপলোড**: সরাসরি ইউটিউবে আপলোড
- ✅ **YouTube Shorts**: শর্টস হিসেবে আপলোড
- ✅ **বাল্ক আপলোড**: একসাথে একাধিক ভিডিও আপলোড
- ✅ **Google Drive**: জিপ ফাইল হিসেবে Drive-ে সংরক্ষণ

### শিডিউলিং
- ✅ **অটো শিডিউল**: নির্দিষ্ট সময়ে আপলোড
- ✅ **রিকারিং**: প্রতিদিন/সাপ্তাহিক শিডিউল
- ✅ **টাইমজোন**: বাংলাদেশ সময় অনুযায়ী

## ইনস্টলেশন

### ১. রিপোজিটরি ক্লোন করুন

```bash
git clone https://github.com/yourusername/youtube-automation.git
cd youtube-automation
```

### ২. ডিপেন্ডেন্সি ইনস্টল করুন

```bash
npm run install:all
```

### ৩. এনভায়রনমেন্ট ভেরিয়েবল সেটআপ

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

`.env` ফাইলে আপনার API কীগুলো যোগ করুন:

```env
# YouTube OAuth (Google Cloud Console থেকে পাবেন)
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret

# Google Drive OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# AI APIs
GEMINI_API_KEY=your_gemini_api_key
GROK_API_KEY=your_grok_api_key  # Optional
```

### ৪. ডেভেলপমেন্ট সার্ভার চালু করুন

```bash
npm run dev
```

- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## Railway-তে ডেপ্লয়

### ১. Railway CLI ইনস্টল করুন

```bash
npm install -g @railway/cli
```

### ২. Railway-তে লগইন করুন

```bash
railway login
```

### ৩. প্রজেক্ট তৈরি করুন

```bash
railway init
```

### ৪. এনভায়রনমেন্ট ভেরিয়েবল সেট করুন

Railway Dashboard-ে গিয়ে Variables ট্যাবে যোগ করুন:

```
YOUTUBE_CLIENT_ID
YOUTUBE_CLIENT_SECRET
YOUTUBE_REDIRECT_URI=https://your-app.up.railway.app/api/upload/youtube/callback
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://your-app.up.railway.app/api/upload/drive/callback
GEMINI_API_KEY
```

### ৫. ডেপ্লয় করুন

```bash
railway up
```

## API ডকুমেন্টেশন

### ভিডিও এন্ডপয়েন্টস

```
POST   /api/videos/download         # ভিডিও ডাউনলোড
POST   /api/videos/download/bulk    # বাল্ক ডাউনলোড
GET    /api/videos                  # সব ভিডিও
GET    /api/videos/:id              # নির্দিষ্ট ভিডিও
POST   /api/videos/:id/mute         # মিউট করুন
POST   /api/videos/:id/merge        # অডিও যোগ করুন
POST   /api/videos/:id/auto-merge   # অটো অডিও যোগ
DELETE /api/videos/:id              # ভিডিও মুছুন
```

### অডিও এন্ডপয়েন্টস

```
POST   /api/audio/upload            # অডিও আপলোড
POST   /api/audio/download          # YouTube থেকে ডাউনলোড
GET    /api/audio                   # সব অডিও
DELETE /api/audio/:id               # অডিও মুছুন
```

### আপলোড এন্ডপয়েন্টস

```
GET    /api/upload/youtube/auth     # YouTube OAuth URL
POST   /api/upload/youtube/:id      # YouTube-এ আপলোড
POST   /api/upload/youtube/bulk     # বাল্ক আপলোড
GET    /api/upload/drive/auth       # Drive OAuth URL
POST   /api/upload/drive/:id        # Drive-এ আপলোড
POST   /api/upload/drive/zip        # জিপ আপলোড
```

### AI এন্ডপয়েন্টস

```
POST   /api/ai/generate             # কন্টেন্ট জেনারেট
POST   /api/ai/analyze              # SEO অ্যানালাইসিস
GET    /api/ai/config               # AI কনফিগ
```

### শিডিউল এন্ডপয়েন্টস

```
POST   /api/schedule                # শিডিউল তৈরি
POST   /api/schedule/bulk           # বাল্ক শিডিউল
GET    /api/schedule                # সব শিডিউল
PATCH  /api/schedule/:id            # আপডেট
DELETE /api/schedule/:id            # মুছুন
```

## মোবাইল অপ্টিমাইজেশন

এই অ্যাপটি মোবাইল-ফার্স্ট ডিজাইন করা হয়েছে:

- 📱 রেসপনসিভ UI
- 📱 টাচ-ফ্রেন্ডলি কন্ট্রোলস
- 📱 ফাস্ট লোডিং
- 📱 PWA সাপোর্ট (আসছে)

## সাপোর্টেড প্ল্যাটফর্ম

| প্ল্যাটফর্ম | ডাউনলোড | নোট |
|------------|---------|-----|
| YouTube | ✅ | সব ফরম্যাট |
| TikTok | ✅ | উইথাউট ওয়াটারমার্ক |
| Instagram | ✅ | রিলস |
| Facebook | ✅ | ভিডিও |

## ট্রাবলশুটিং

### ভিডিও ডাউনলোড হচ্ছে না

```bash
# yt-dlp আপডেট করুন
cd backend
npx yt-dlp-wrap update
```

### FFmpeg এরর

```bash
# FFmpeg ইনস্টল করুন
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg
```

### YouTube OAuth এরর

1. Google Cloud Console-ে যান
2. Credentials > OAuth 2.0 Client IDs
3. Authorized redirect URIs-তে আপনার URL যোগ করুন

## লাইসেন্স

MIT License

## কন্ট্রিবিউশন

পুল রিকোয়েস্ট স্বাগতম! বড় পরিবর্তনের আগে একটি ইস্যু তৈরি করুন।

## সাপোর্ট

প্রশ্ন থাকলে ইস্যু তৈরি করুন বা ইমেইল করুন।

---

**Made with ❤️ for Bangladeshi Content Creators**
