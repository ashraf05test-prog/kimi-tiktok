#!/usr/bin/env python3
# KDrama/Anime Uploader - Termux Script
# Usage: python3 upload.py

import os
import sys
import json
import asyncio
import subprocess
import re
from pathlib import Path

# ===== CONFIG FILE =====
CONFIG_FILE = os.path.expanduser('~/.kdrama_config.json')

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            return json.load(open(CONFIG_FILE))
        except:
            pass
    return {}

def save_config(cfg):
    json.dump(cfg, open(CONFIG_FILE, 'w'), indent=2)
    print('✅ Config saved')

def ask(prompt, default=None):
    if default:
        val = input(f'{prompt} [{default}]: ').strip()
        return val if val else default
    else:
        while True:
            val = input(f'{prompt}: ').strip()
            if val:
                return val
            print('❌ Empty না দাও')

def ask_optional(prompt, default=None):
    if default:
        val = input(f'{prompt} [{default}]: ').strip()
        return val if val else default
    val = input(f'{prompt} (optional, enter skip): ').strip()
    return val if val else None

# ===== SRT → ASS =====
def srt_to_ass(srt_path, ass_path, font_size=22, color='white', bg='semi', position='bottom', bold=False, italic=False):
    color_map = {'white': '&H00FFFFFF', 'yellow': '&H0000FFFF', 'cyan': '&H00FFFF00'}
    bg_map = {'semi': '&H80000000', 'black': '&H00000000', 'none': '&H00000000'}
    align_map = {'bottom': 2, 'middle': 5, 'top': 8}
    
    col = color_map.get(color, '&H00FFFFFF')
    back = bg_map.get(bg, '&H80000000')
    bstyle = 1 if bg == 'none' else 3
    align = align_map.get(position, 2)
    b = -1 if bold else 0
    i = -1 if italic else 0

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans Bengali,{font_size},{col},&H000000FF,&H00000000,{back},{b},{i},0,0,100,100,0,0,{bstyle},1,0,{align},20,20,25,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    def to_ass_time(t):
        t = t.strip().replace(',', '.')
        return t

    srt = open(srt_path, encoding='utf-8').read().strip()
    blocks = re.split(r'\n\s*\n', srt)
    events = []
    for block in blocks:
        lines = block.strip().split('\n')
        if len(lines) < 3:
            continue
        try:
            ts = lines[1].split(' --> ')
            text = r'\N'.join(lines[2:])
            text = re.sub(r'<[^>]+>', '', text)
            events.append(f"Dialogue: 0,{to_ass_time(ts[0])},{to_ass_time(ts[1])},Default,,0,0,0,,{text}")
        except:
            continue

    with open(ass_path, 'w', encoding='utf-8') as f:
        f.write(header + '\n'.join(events))
    print(f'✅ ASS ready: {len(events)} lines')
    return ass_path

# ===== FFMPEG =====
def run_ffmpeg(m3u8_url, output_path, ass_path=None, compress=False):
    print('\n🔥 ffmpeg শুরু...')
    
    vf = None
    if ass_path and compress:
        esc = ass_path.replace(':', '\\:')
        vf = f"scale=1280:720,ass='{esc}'"
    elif ass_path:
        esc = ass_path.replace(':', '\\:')
        vf = f"ass='{esc}'"
    elif compress:
        vf = 'scale=1280:720'

    cmd = [
        'ffmpeg', '-y',
        '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        '-allowed_extensions', 'ALL',
        '-protocol_whitelist', 'file,http,https,tcp,tls,crypto,hls',
        '-i', m3u8_url,
    ]

    if vf:
        cmd += ['-vf', vf, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-threads', '0']
    else:
        cmd += ['-c:v', 'copy']

    cmd += ['-c:a', 'aac', '-max_muxing_queue_size', '1024', output_path]

    print(f'▶ CMD: {" ".join(cmd[:8])}...')

    proc = subprocess.Popen(cmd, stderr=subprocess.PIPE, text=True, bufsize=1)
    duration = 0
    last_pct = -1

    for line in iter(proc.stderr.readline, ''):
        line = line.strip()
        dur_match = re.search(r'Duration:\s*(\d+):(\d+):(\d+)', line)
        if dur_match:
            h, m, s = int(dur_match[1]), int(dur_match[2]), int(dur_match[3])
            duration = h*3600 + m*60 + s
            print(f'⏱ Duration: {dur_match[1]}:{dur_match[2]}:{dur_match[3]}')

        time_match = re.search(r'time=(\d+):(\d+):(\d+)', line)
        if time_match and duration > 0:
            h, m, s = int(time_match[1]), int(time_match[2]), int(time_match[3])
            cur = h*3600 + m*60 + s
            pct = min(99, int(cur/duration*100))
            if pct >= last_pct + 5:
                last_pct = pct
                print(f'⏳ {pct}% — {time_match[1]}:{time_match[2]}:{time_match[3]}')

        if 'error' in line.lower() and 'skip' not in line.lower():
            print(f'⚠️ {line[:150]}')

    proc.wait()
    if proc.returncode != 0:
        raise Exception(f'ffmpeg failed with code {proc.returncode}')

    size = os.path.getsize(output_path) / 1024 / 1024
    print(f'✅ Video ready! {size:.1f}MB → {output_path}')
    return output_path

# ===== TELEGRAM UPLOAD =====
async def upload_telegram(video_path, title, caption, api_id, api_hash, phone, channel, session_str=None):
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
    except ImportError:
        print('❌ telethon নেই। Install করো: pip install telethon')
        sys.exit(1)

    print('\n📤 Telegram upload শুরু...')
    
    if session_str:
        client = TelegramClient(StringSession(session_str), int(api_id), api_hash)
        await client.connect()
    else:
        session_file = os.path.expanduser(f'~/.tg_session_{api_id}')
        client = TelegramClient(session_file, int(api_id), api_hash)
        await client.start(phone=phone)

    print('✅ Connected!')
    entity = await client.get_entity(channel)
    
    full_caption = f'**{title}**\n\n{caption}' if caption else f'**{title}**'
    
    last = [0]
    def progress(current, total):
        pct = int(current/total*100)
        if pct // 10 != last[0] // 10:
            last[0] = pct
            print(f'📤 Upload {pct}%')

    msg = await client.send_file(
        entity, video_path,
        caption=full_caption,
        supports_streaming=True,
        progress_callback=progress
    )
    
    await client.disconnect()
    print(f'🎉 Done! https://t.me/{channel.lstrip("@")}/{msg.id}')
    return msg

# ===== SUBTITLE SETTINGS =====
def get_subtitle_settings():
    print('\n🎨 Subtitle Settings:')
    print('  Font size: 1) Small(18) 2) Medium(22) 3) Large(28) 4) XLarge(34)')
    size_map = {'1': 18, '2': 22, '3': 28, '4': 34}
    sz = input('  Choice [2]: ').strip() or '2'
    font_size = size_map.get(sz, 22)

    print('  Color: 1) White 2) Yellow 3) Cyan')
    color_map = {'1': 'white', '2': 'yellow', '3': 'cyan'}
    col = input('  Choice [1]: ').strip() or '1'
    color = color_map.get(col, 'white')

    print('  Background: 1) Semi-transparent 2) Solid Black 3) None')
    bg_map = {'1': 'semi', '2': 'black', '3': 'none'}
    bg_c = input('  Choice [1]: ').strip() or '1'
    bg = bg_map.get(bg_c, 'semi')

    print('  Position: 1) Bottom 2) Middle 3) Top')
    pos_map = {'1': 'bottom', '2': 'middle', '3': 'top'}
    pos_c = input('  Choice [1]: ').strip() or '1'
    position = pos_map.get(pos_c, 'bottom')

    bold = input('  Bold? (y/n) [n]: ').strip().lower() == 'y'
    italic = input('  Italic? (y/n) [n]: ').strip().lower() == 'y'

    return font_size, color, bg, position, bold, italic

# ===== MAIN =====
def main():
    print('=' * 50)
    print('🎬 KDrama/Anime Uploader')
    print('=' * 50)

    cfg = load_config()

    # ---- Telegram credentials ----
    print('\n📲 Telegram Credentials:')
    api_id = ask('API ID', cfg.get('api_id'))
    api_hash = ask('API Hash', cfg.get('api_hash'))
    phone = ask('Phone (+880...)', cfg.get('phone'))
    channel = ask('Channel (@username)', cfg.get('channel'))
    session_str = cfg.get('session_str', '')

    # Save credentials
    cfg.update({'api_id': api_id, 'api_hash': api_hash, 'phone': phone, 'channel': channel})
    save_config(cfg)

    # ---- Video ----
    print('\n🎥 Video:')
    m3u8_url = ask('m3u8 URL')
    title = ask('Title', 'Episode')
    caption = ask_optional('Caption / Hashtag', cfg.get('last_caption', ''))
    if caption:
        cfg['last_caption'] = caption
        save_config(cfg)

    # ---- Subtitle ----
    print('\n📝 Subtitle:')
    print('  1) .ass file দাও')
    print('  2) .srt file দাও (ASS-এ convert হবে)')
    print('  3) Subtitle নেই')
    sub_choice = input('  Choice [3]: ').strip() or '3'

    ass_path = None
    if sub_choice in ('1', '2'):
        sub_file = ask('Subtitle file path')
        sub_file = sub_file.strip('"\'')
        if not os.path.exists(sub_file):
            print(f'❌ File নেই: {sub_file}')
            sys.exit(1)

        if sub_choice == '2' or sub_file.endswith('.srt') or sub_file.endswith('.vtt'):
            font_size, color, bg, position, bold, italic = get_subtitle_settings()
            ass_path = sub_file + '.ass'
            srt_to_ass(sub_file, ass_path, font_size, color, bg, position, bold, italic)
        else:
            ass_path = sub_file

    # ---- Compress ----
    compress = input('\n🗜 Compress 720p? (y/n) [n]: ').strip().lower() == 'y'

    # ---- Output path ----
    out_dir = os.path.expanduser('~/kdrama_output')
    os.makedirs(out_dir, exist_ok=True)
    safe_title = re.sub(r'[^\w\s-]', '', title).strip().replace(' ', '_')
    output_path = os.path.join(out_dir, f'{safe_title}.mp4')

    # ---- Confirm ----
    print('\n' + '=' * 50)
    print('📋 Summary:')
    print(f'  URL: {m3u8_url[:60]}...')
    print(f'  Title: {title}')
    print(f'  Subtitle: {ass_path or "নেই"}')
    print(f'  Compress: {"হ্যাঁ" if compress else "না"}')
    print(f'  Channel: {channel}')
    print(f'  Output: {output_path}')
    print('=' * 50)
    
    go = input('\n🚀 Start? (y/n) [y]: ').strip().lower()
    if go == 'n':
        print('বাদ দিলাম।')
        sys.exit(0)

    # ---- Run ----
    try:
        run_ffmpeg(m3u8_url, output_path, ass_path, compress)
        asyncio.run(upload_telegram(output_path, title, caption or '', api_id, api_hash, phone, channel, session_str))
        
        # Cleanup
        if input('\n🗑 Output file delete করব? (y/n) [y]: ').strip().lower() != 'n':
            os.remove(output_path)
            print('🗑 Deleted')

    except KeyboardInterrupt:
        print('\n⛔ বাতিল করা হয়েছে।')
    except Exception as e:
        print(f'\n❌ Error: {e}')
        sys.exit(1)

if __name__ == '__main__':
    main()
