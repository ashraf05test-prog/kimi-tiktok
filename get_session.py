#!/usr/bin/env python3
# Termux-এ চালাও:
# pip install telethon
# python3 get_session.py

from telethon.sync import TelegramClient
from telethon.sessions import StringSession

api_id = int(input("API ID: "))
api_hash = input("API Hash: ")
phone = input("Phone (+880...): ")

with TelegramClient(StringSession(), api_id, api_hash) as client:
    client.start(phone=phone)
    print("\n✅ Session String (এটা Railway-তে env variable-এ দাও):")
    print("\nTG_SESSION=" + client.session.save())
    print("\n⚠️ এটা কাউকে দেখাবে না!")
