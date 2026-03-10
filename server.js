const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { promisify } = require('util');
const { exec } = require('child_process');
const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;
const TEMP_DIR = path.join(__dirname, 'temp');
const QUEUE_FILE = path.join(__dirname, 'queue', 'tasks.json');

[TEMP_DIR, path.join(__dirname, 'queue')].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: TEMP_DIR });

// ========== QUEUE ==========
let queue = [];
let isProcessing = false;
const sseClients = []; // SSE broadcast clients

function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      // Reset stuck processing tasks
      queue.forEach(t => { if (t.status === 'processing') t.status = 'pending'; });
      saveQueue();
    }
  } catch { queue = []; }
}

function saveQueue() {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(res => { try { res.write(msg); } catch {} });
}

function log(taskId, msg, level = 'info') {
  const entry = { time: new Date().toISOString(), msg, level };
  const task = queue.find(t => t.id === taskId);
  if (task) {
    if (!task.logs) task.logs = [];
    // Keep max 200 logs per task
    if (task.logs.length > 200) task.logs = task.logs.slice(-150);
    task.logs.push(entry);
    // Don't save to disk every single log — too slow
    if (task.logs.length % 10 === 0) saveQueue();
  }
  console.log(`[${taskId}] ${msg}`);
  broadcast({ type: 'log', taskId, ...entry });
}

function setStatus(taskId, status, extra = {}) {
  const task = queue.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    Object.assign(task, extra);
    saveQueue();
  }
  broadcast({ type: 'status', taskId, status, ...extra });
}

// ========== SSE ==========
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  sseClients.push(res);

  // Send current queue state
  res.write(`data: ${JSON.stringify({ type: 'init', queue })}\n\n`);

  req.on('close', () => {
    const i = sseClients.indexOf(res);
    if (i > -1) sseClients.splice(i, 1);
  });
});

// ========== API ==========
app.get('/api/queue', (req, res) => res.json(queue));

app.post('/api/queue/add', upload.single('subtitle'), (req, res) => {
  const { m3u8Url, title, caption, apiId, apiHash, phone, channelUsername, compress } = req.body;

  if (!m3u8Url) return res.status(400).json({ error: 'm3u8 URL দাও' });
  if (!apiId || !apiHash || !phone) return res.status(400).json({ error: 'Telegram credentials দাও' });
  if (!channelUsername) return res.status(400).json({ error: 'Channel username দাও' });

  const task = {
    id: Date.now().toString(),
    m3u8Url,
    title: title || 'Episode',
    caption: caption || '',
    apiId,
    apiHash,
    phone,
    channelUsername,
    compress: compress === 'true',
    subFile: req.file ? { path: req.file.path, name: req.file.originalname } : null,
    status: 'pending',
    progress: 0,
    logs: [],
    createdAt: new Date().toISOString(),
  };

  queue.push(task);
  saveQueue();
  broadcast({ type: 'added', task });
  res.json({ id: task.id, message: 'Queue-এ যোগ হয়েছে' });

  processNext();
});

app.delete('/api/queue/:id', (req, res) => {
  const idx = queue.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  if (queue[idx].status === 'processing') return res.status(400).json({ error: 'Processing-এ আছে' });
  queue.splice(idx, 1);
  saveQueue();
  broadcast({ type: 'removed', taskId: req.params.id });
  res.json({ ok: true });
});

app.post('/api/queue/:id/retry', (req, res) => {
  const task = queue.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });
  task.status = 'pending';
  task.logs = [];
  task.progress = 0;
  saveQueue();
  broadcast({ type: 'status', taskId: task.id, status: 'pending' });
  res.json({ ok: true });
  processNext();
});

app.get('/api/status', (req, res) => res.json({ ok: true, queue: queue.length, processing: isProcessing }));

// ========== PROCESSOR ==========
async function processNext() {
  if (isProcessing) return;
  const task = queue.find(t => t.status === 'pending');
  if (!task) return;

  isProcessing = true;
  setStatus(task.id, 'processing');

  try {
    await processTask(task);
    setStatus(task.id, 'done', { progress: 100 });
    log(task.id, '🎉 সব শেষ! Successfully uploaded!', 'ok');
  } catch (e) {
    setStatus(task.id, 'error', { error: e.message });
    log(task.id, '❌ Error: ' + e.message, 'err');
  }

  isProcessing = false;
  processNext(); // process next in queue
}

async function processTask(task) {
  const rawPath = path.join(TEMP_DIR, `raw_${task.id}.mp4`);
  const outputPath = path.join(TEMP_DIR, `output_${task.id}.mp4`);
  let subPath = null;

  try {
    if (task.subFile && fs.existsSync(task.subFile.path)) {
      const ext = task.subFile.name.split('.').pop().toLowerCase();
      subPath = task.subFile.path + '.' + ext;
      fs.renameSync(task.subFile.path, subPath);
    }

    const isM3u8 = task.m3u8Url.includes('.m3u8');

    if (isM3u8) {
      log(task.id, '🔥 m3u8 direct burn শুরু...');
      await runFFmpegDirect(task, outputPath, subPath);
    } else {
      log(task.id, '⬇️ yt-dlp দিয়ে download হচ্ছে...');
      await runYtDlp(task, rawPath);
      const rawSize = fs.statSync(rawPath).size;
      log(task.id, `✅ Download! ${(rawSize/1024/1024).toFixed(1)}MB`);
      setStatus(task.id, 'processing', { progress: 50 });
      if (subPath || task.compress) {
        await runFFmpegBurn(task, rawPath, outputPath, subPath);
        try { fs.unlinkSync(rawPath); } catch {}
      } else {
        fs.renameSync(rawPath, outputPath);
      }
    }

    const fileSize = fs.statSync(outputPath).size;
    log(task.id, `✅ Video ready! ${(fileSize/1024/1024).toFixed(1)}MB`);
    setStatus(task.id, 'processing', { progress: 80 });
    log(task.id, '📤 Telegram upload শুরু...');
    await uploadWithTelethon(task, outputPath);
    setStatus(task.id, 'processing', { progress: 95 });

  } finally {
    [rawPath, outputPath, subPath, task.subFile?.path].forEach(f => {
      if (f && fs.existsSync(f)) { try { fs.unlinkSync(f); } catch {} }
    });
  }
}

function runFFmpegDirect(task, outputPath, subPath) {
  return new Promise((resolve, reject) => {
    let vfFilter = '';
    if (task.compress && subPath) {
      const esc = subPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      const ext = path.extname(subPath).toLowerCase();
      vfFilter = `scale=1280:720,${ext === '.ass' ? `ass='${esc}'` : `subtitles='${esc}'`}`;
    } else if (task.compress) {
      vfFilter = 'scale=1280:720';
    } else if (subPath) {
      const esc = subPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      const ext = path.extname(subPath).toLowerCase();
      vfFilter = ext === '.ass' ? `ass='${esc}'` : `subtitles='${esc}':force_style='FontName=Noto Sans Bengali,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Outline=2,Shadow=1,MarginV=25'`;
    }

    const args = ['-y', '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '-i', task.m3u8Url];
    if (vfFilter) {
      args.push('-vf', vfFilter, '-c:v', 'libx264', '-preset', 'fast', '-crf', task.compress ? '28' : '23');
    } else {
      args.push('-c:v', 'copy');
    }
    args.push('-c:a', 'aac', '-max_muxing_queue_size', '1024', outputPath);

    log(task.id, '▶ ffmpeg ' + (vfFilter ? 'burn+encode' : 'stream copy'));
    const ff = spawn('ffmpeg', args);
    let duration = 0, lastPct = 0;

    ff.stderr.on('data', data => {
      const line = data.toString();
      const durMatch = line.match(/Duration:\s*(\d+):(\d+):(\d+)/);
      if (durMatch) {
        duration = parseInt(durMatch[1])*3600 + parseInt(durMatch[2])*60 + parseInt(durMatch[3]);
        log(task.id, `⏱ Duration: ${durMatch[1]}:${durMatch[2]}:${durMatch[3]}`);
      }
      const timeMatch = line.match(/time=(\d+):(\d+):(\d+)/);
      if (timeMatch && duration > 0) {
        const cur = parseInt(timeMatch[1])*3600 + parseInt(timeMatch[2])*60 + parseInt(timeMatch[3]);
        const pct = Math.min(78, Math.floor((cur/duration)*78));
        if (pct >= lastPct + 5) {
          lastPct = pct;
          log(task.id, `⏳ ${pct}% — ${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`);
          setStatus(task.id, 'processing', { progress: pct });
        }
      }
    });

    ff.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1024*1024) resolve();
      else reject(new Error(`ffmpeg exit code ${code}`));
    });
    ff.on('error', e => reject(new Error('ffmpeg failed: ' + e.message)));
  });
}


// yt-dlp download
function runYtDlp(task, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '--no-warnings',
      '--format', 'best/bestvideo+bestaudio',
      '--merge-output-format', 'mp4',
      '--concurrent-fragments', '10',
      '--retries', '10',
      '--fragment-retries', '10',
      '--ffmpeg-location', '/usr/bin/ffmpeg',
      '--compat-options', 'no-direct-merge',
      '-o', outputPath,
      task.m3u8Url,
    ];

    log(task.id, '⬇️ yt-dlp downloading...');
    const ytdlp = spawn('yt-dlp', args);
    let lastLogPct = -1;

    ytdlp.stdout.on('data', data => {
      const line = data.toString().trim();
      if (!line) return;
      // Only log every 10% to avoid freeze
      const pctMatch = line.match(/(\d+\.\d+)%/);
      if (pctMatch) {
        const pct = Math.floor(parseFloat(pctMatch[1]) / 10) * 10;
        if (pct !== lastLogPct) {
          lastLogPct = pct;
          const etaMatch = line.match(/ETA\s+(\S+)/);
          log(task.id, `⬇️ ${pct}%${etaMatch ? ' ETA ' + etaMatch[1] : ''}`);
          setStatus(task.id, 'processing', { progress: Math.floor(pct * 0.45) });
        }
      } else if (!line.includes('[download]')) {
        log(task.id, line);
      }
    });

    ytdlp.stderr.on('data', data => {
      const line = data.toString().trim();
      if (line) log(task.id, '⚠️ ' + line, 'err');
    });

    ytdlp.on('close', code => {
      if (code === 0 && fs.existsSync(outputPath)) resolve();
      else reject(new Error(`yt-dlp exit code ${code}`));
    });

    ytdlp.on('error', e => reject(new Error('yt-dlp not found: ' + e.message)));
  });
}

// ffmpeg subtitle burn / compress
function runFFmpegBurn(task, inputPath, outputPath, subPath) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', inputPath];

    if (task.compress) {
      let vf = 'scale=1280:720';
      if (subPath) {
        const ext = path.extname(subPath).toLowerCase();
        const esc = subPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        vf += ext === '.ass' ? `,ass='${esc}'` : `,subtitles='${esc}':force_style='FontName=Noto Sans Bengali,FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Outline=2,Shadow=1,MarginV=25'`;
      }
      args.push('-vf', vf, '-c:v', 'libx264', '-preset', 'fast', '-crf', '28');
    } else if (subPath) {
      const ext = path.extname(subPath).toLowerCase();
      const esc = subPath.replace(/\\/g, '/').replace(/:/g, '\\:');
      const vf = ext === '.ass'
        ? `ass='${esc}'`
        : `subtitles='${esc}':force_style='FontName=Noto Sans Bengali,FontSize=16,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Outline=2,Shadow=1,MarginV=25'`;
      args.push('-vf', vf, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23');
    }

    args.push('-c:a', 'copy', outputPath);

    const ff = spawn('ffmpeg', args);
    let duration = 0;
    let lastPct = 0;

    ff.stderr.on('data', data => {
      const line = data.toString();
      const durMatch = line.match(/Duration:\s*(\d+):(\d+):(\d+)/);
      if (durMatch) {
        duration = parseInt(durMatch[1])*3600 + parseInt(durMatch[2])*60 + parseInt(durMatch[3]);
      }
      const timeMatch = line.match(/time=(\d+):(\d+):(\d+)/);
      if (timeMatch && duration > 0) {
        const cur = parseInt(timeMatch[1])*3600 + parseInt(timeMatch[2])*60 + parseInt(timeMatch[3]);
        const pct = Math.min(28, Math.floor((cur/duration)*28));
        if (pct >= lastPct + 5) {
          lastPct = pct;
          log(task.id, `🎬 Burn ${50+pct}% — ${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`);
          setStatus(task.id, 'processing', { progress: 50+pct });
        }
      }
    });

    ff.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg burn exit code ${code}`));
    });
    ff.on('error', e => reject(new Error('ffmpeg failed: ' + e.message)));
  });
}

async function uploadWithTelethon(task, videoPath) {
  return new Promise((resolve, reject) => {
    const caption = [task.title, task.caption].filter(Boolean).join('\n\n');
    const script = `
import asyncio, sys, os
from telethon import TelegramClient
from telethon.sessions import StringSession

api_id = int(${JSON.stringify(task.apiId)})
api_hash = ${JSON.stringify(task.apiHash)}
phone = ${JSON.stringify(task.phone)}
channel = ${JSON.stringify(task.channelUsername)}
video_path = ${JSON.stringify(videoPath)}
caption = ${JSON.stringify(caption)}
session_str = os.environ.get('TG_SESSION', '')

async def main():
    if session_str:
        client = TelegramClient(StringSession(session_str), api_id, api_hash)
        await client.connect()
    else:
        client = TelegramClient('/app/temp/session_' + str(api_id), api_id, api_hash)
        await client.start(phone=phone)
    print('[TG] Connected')
    entity = await client.get_entity(channel)
    print('[TG] Uploading...')
    
    size = os.path.getsize(video_path)
    uploaded = 0
    
    def progress(current, total):
        global uploaded
        pct = int(current/total*100)
        if pct % 10 == 0 and pct != uploaded:
            uploaded = pct
            print(f'[TG] Upload {pct}%', flush=True)
    
    await client.send_file(
        entity,
        video_path,
        caption=caption,
        supports_streaming=True,
        progress_callback=progress
    )
    print('[TG] Done!')
    await client.disconnect()

asyncio.run(main())
`;

    const scriptPath = path.join(TEMP_DIR, `tg_${task.id}.py`);
    fs.writeFileSync(scriptPath, script, 'utf8');

    const py = spawn('python3', [scriptPath]);

    py.stdout.on('data', data => {
      data.toString().split('\n').forEach(line => {
        if (line.trim()) log(task.id, line.trim());
      });
    });

    py.stderr.on('data', data => {
      const line = data.toString().trim();
      if (line && !line.includes('WARNING')) log(task.id, '⚠️ ' + line, 'err');
    });

    py.on('close', code => {
      try { fs.unlinkSync(scriptPath); } catch {}
      if (code === 0) resolve();
      else reject(new Error(`Telethon exit code ${code}`));
    });

    py.on('error', e => reject(new Error('Python spawn failed: ' + e.message)));
  });
}

// ========== BOOT ==========
loadQueue();
app.listen(PORT, () => {
  console.log(`🚀 KDrama Uploader on port ${PORT}`);
  exec('ffmpeg -version 2>&1 | head -1', (e, out) => console.log(e ? '❌ ffmpeg missing' : '✓ ' + out.trim()));
  exec('python3 -c "import telethon; print(telethon.__version__)"', (e, out) => console.log(e ? '❌ telethon missing' : '✓ telethon ' + out.trim()));
  // Resume pending tasks
  processNext();
});
