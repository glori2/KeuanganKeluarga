import os
import asyncio
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

from database import SessionLocal
import models

load_dotenv()
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    telegram_id = str(user.id)
    
    db = SessionLocal()
    anggota = db.query(models.Anggota).filter(models.Anggota.telegram_id == telegram_id).first()
    
    if anggota:
        await update.message.reply_text(f"Halo {anggota.name}! Selamat datang kembali di Pencatat Keuangan Keluarga.")
    else:
        # Check if there are any members at all
        any_anggota = db.query(models.Anggota).first()
        if not any_anggota:
            # First time setup! Let's create a Family and an Admin Member
            keluarga = models.Keluarga(name=f"Keluarga {user.first_name}")
            db.add(keluarga)
            db.commit()
            db.refresh(keluarga)
            
            rekening = models.Rekening(keluarga_id=keluarga.id, name="Dompet Utama", balance=0.0)
            db.add(rekening)
            
            anggota = models.Anggota(
                keluarga_id=keluarga.id,
                name=user.first_name,
                telegram_id=telegram_id,
                role=models.RoleEnum.admin
            )
            db.add(anggota)
            db.commit()
            
            await update.message.reply_text(
                f"🎉 Selamat datang {user.first_name}! Keluarga dan Dompet Utama telah dibuat.\n"
                "Anda sekarang adalah Admin Keluarga. Gunakan /catat untuk mencatat pengeluaran."
            )
        else:
            # Look for an unlinked admin/member account created by seed or UI
            unlinked_anggota = db.query(models.Anggota).filter(models.Anggota.telegram_id == None).first()
            if unlinked_anggota:
                unlinked_anggota.telegram_id = telegram_id
                db.commit()
                await update.message.reply_text(
                    f"✅ Akun Telegram Anda telah ditautkan ke profil: {unlinked_anggota.name}!"
                )
            else:
                await update.message.reply_text(
                    f"Halo! Akun Telegram Anda ({telegram_id}) belum terdaftar.\n"
                    "Minta Admin keluarga untuk menambahkan ID Anda dari Dashboard."
                )
    db.close()

async def saldo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    telegram_id = str(update.effective_user.id)
    db = SessionLocal()
    anggota = db.query(models.Anggota).filter(models.Anggota.telegram_id == telegram_id).first()
    
    if not anggota:
        await update.message.reply_text("Akun Anda belum terdaftar.")
        db.close()
        return
        
    keluarga_id = anggota.keluarga_id
    rekening_list = db.query(models.Rekening).filter(models.Rekening.keluarga_id == keluarga_id).all()
    
    if not rekening_list:
        await update.message.reply_text("Belum ada rekening untuk keluarga ini.")
    else:
        msg = "📊 *Saldo Rekening Keluarga*\n\n"
        total = 0
        for rek in rekening_list:
            msg += f"- {rek.name}: Rp {rek.balance:,.2f}\n"
            total += rek.balance
        msg += f"\n*Total: Rp {total:,.2f}*"
        await update.message.reply_text(msg, parse_mode="Markdown")
        
    db.close()

async def catat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    # Format: /catat [nominal] [kategori] [deskripsi]
    # Contoh: /catat 50000 Makan Siang
    
    telegram_id = str(update.effective_user.id)
    db = SessionLocal()
    anggota = db.query(models.Anggota).filter(models.Anggota.telegram_id == telegram_id).first()
    
    if not anggota:
        await update.effective_message.reply_text("Akun Anda belum terdaftar.")
        db.close()
        return
        
    args = context.args
    if len(args) < 2:
        await update.effective_message.reply_text("Format salah. Gunakan:\n/catat [nominal] [kategori] [deskripsi]")
        db.close()
        return
        
    try:
        amount = float(args[0])
        category = args[1]
        description = " ".join(args[2:]) if len(args) > 2 else ""
        
        # Cari rekening pertama untuk contoh (idealnya bisa dipilih)
        rekening = db.query(models.Rekening).filter(models.Rekening.keluarga_id == anggota.keluarga_id).first()
        if not rekening:
            await update.effective_message.reply_text("Belum ada rekening.")
            db.close()
            return
            
        transaksi = models.Transaksi(
            rekening_id=rekening.id,
            anggota_id=anggota.id,
            amount=amount,
            type=models.TransaksiTypeEnum.expense, # asumsikan expense untuk catat cepat
            category=category,
            description=description
        )
        
        rekening.balance -= amount
        db.add(transaksi)
        db.commit()
        
        await update.effective_message.reply_text(f"✅ Transaksi berhasil dicatat.\nPengeluaran: Rp {amount:,.2f}\nKategori: {category}")
        
    except ValueError:
        await update.effective_message.reply_text("Nominal harus berupa angka.")
    finally:
        db.close()

def main():
    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("Please set TELEGRAM_BOT_TOKEN in .env file")
        return
        
    application = Application.builder().token(BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("saldo", saldo))
    application.add_handler(CommandHandler("catat", catat))

    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
