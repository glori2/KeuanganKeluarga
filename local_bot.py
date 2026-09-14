import os
from dotenv import load_dotenv
from telegram.ext import Application, CommandHandler
import sys

# Add api folder to path to import bot modules
sys.path.append(os.path.join(os.path.dirname(__file__), 'api'))

from api import bot

load_dotenv(os.path.join(os.path.dirname(__file__), 'api', '.env'))
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

if not BOT_TOKEN:
    print("TELEGRAM_BOT_TOKEN tidak ditemukan di api/.env!")
    sys.exit(1)

def main():
    print("Menjalankan Bot Telegram secara LOKAL (Polling Mode)...")
    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", bot.start))
    app.add_handler(CommandHandler("saldo", bot.saldo))
    app.add_handler(CommandHandler("catat", bot.catat))

    print("Bot siap menerima pesan!")
    app.run_polling()

if __name__ == "__main__":
    main()
