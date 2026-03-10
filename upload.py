#!/usr/bin/env python3
# Telegram Upload Only
# Usage: python3 tg_upload.py

import os
import sys
import json
import asyncio

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

def ask(prompt, default=None):
    if default:
        val = input(f'{prompt} [{default}]: ').strip()
        return val if val else default
    while True:
        val = input(f'{prompt}: ').strip()
        if val:
            return val
        print('❌ Empty না দাও')

async def upload(video_path, title, caption, api_id, api_hash, phone, channel, session_str=None):
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
    except ImportError:
        print('❌ pip install telethon --break-system-packages')
        sys.exit(1)

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
        pct = int(current / total * 100)
        if pct // 10 != last[0] // 10:
            last[0] = pct
            print(f'📤 Upload {pct}%')

    size = os.path.getsize(video_path) / 1024 / 1024
    print(f'📁 File: {size:.1f}MB')

    msg = await client.send_file(
        entity, video_path,
        caption=full_caption,
        supports_streaming=True,
        progress_callback=progress
    )
    await client.disconnect()
    print(f'🎉 Done! https://t.me/{channel.lstrip("@")}/{msg.id}')

def main():
    print('=' * 45)
    print('📤 Telegram Uploader')
    print('=' * 45)

    cfg = load_config()

    print('\n📲 Telegram:')
    api_id = ask('API ID', cfg.get('api_id'))
    api_hash = ask('API Hash', cfg.get('api_hash'))
    phone = ask('Phone (+880...)', cfg.get('phone'))
    channel = ask('Channel (@username)', cfg.get('channel'))

    cfg.update({'api_id': api_id, 'api_hash': api_hash, 'phone': phone, 'channel': channel})
    save_config(cfg)

    print('\n🎬 Video:')
    video_path = ask('Video file path').strip('"\'')
    if not os.path.exists(video_path):
        print(f'❌ File নেই: {video_path}')
        sys.exit(1)

    title = ask('Title', 'Episode')
    caption = input(f'Caption [{cfg.get("last_caption", "")}]: ').strip()
    if not caption:
        caption = cfg.get('last_caption', '')
    if caption:
        cfg['last_caption'] = caption
        save_config(cfg)

    delete_after = input('\n🗑 Upload শেষে file delete করব? (y/n) [n]: ').strip().lower() == 'y'

    print('\n🚀 Starting...')
    try:
        asyncio.run(upload(video_path, title, caption, api_id, api_hash, phone, channel, cfg.get('session_str')))
        if delete_after:
            os.remove(video_path)
            print('🗑 Deleted')
    except KeyboardInterrupt:
        print('\n⛔ বাতিল')
    except Exception as e:
        print(f'\n❌ Error: {e}')

if __name__ == '__main__':
    main()
