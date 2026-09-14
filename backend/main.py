from fastapi import FastAPI, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

import models, schemas, database

# Create database tables
database.Base.metadata.create_all(bind=database.engine)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Keuangan Keluarga API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
from telegram import Update
from telegram.ext import Application, CommandHandler
import bot

ptb_app = Application.builder().token(os.getenv("TELEGRAM_BOT_TOKEN", "")).build()
ptb_app.add_handler(CommandHandler("start", bot.start))
ptb_app.add_handler(CommandHandler("saldo", bot.saldo))
ptb_app.add_handler(CommandHandler("catat", bot.catat))

import asyncio
_ptb_initialized = False

@app.post("/api/webhook")
async def telegram_webhook(req: Request):
    global _ptb_initialized
    if not _ptb_initialized:
        await ptb_app.initialize()
        _ptb_initialized = True
    
    data = await req.json()
    update = Update.de_json(data, ptb_app.bot)
    await ptb_app.process_update(update)
    return {"ok": True}

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to Keuangan Keluarga API"}

# --- Keluarga Endpoints ---
@app.post("/keluarga/", response_model=schemas.KeluargaResponse)
def create_keluarga(keluarga: schemas.KeluargaCreate, db: Session = Depends(get_db)):
    db_keluarga = models.Keluarga(**keluarga.model_dump())
    db.add(db_keluarga)
    db.commit()
    db.refresh(db_keluarga)
    return db_keluarga

@app.get("/keluarga/", response_model=List[schemas.KeluargaResponse])
def read_keluarga(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Keluarga).offset(skip).limit(limit).all()

# --- Anggota Endpoints ---
@app.post("/anggota/", response_model=schemas.AnggotaResponse)
def create_anggota(anggota: schemas.AnggotaCreate, db: Session = Depends(get_db)):
    db_anggota = models.Anggota(**anggota.model_dump())
    db.add(db_anggota)
    db.commit()
    db.refresh(db_anggota)
    return db_anggota

@app.get("/keluarga/{keluarga_id}/anggota", response_model=List[schemas.AnggotaResponse])
def get_anggota_by_keluarga(keluarga_id: int, db: Session = Depends(get_db)):
    return db.query(models.Anggota).filter(models.Anggota.keluarga_id == keluarga_id).all()

# --- Rekening Endpoints ---
@app.post("/rekening/", response_model=schemas.RekeningResponse)
def create_rekening(rekening: schemas.RekeningCreate, db: Session = Depends(get_db)):
    db_rekening = models.Rekening(**rekening.model_dump())
    db.add(db_rekening)
    db.commit()
    db.refresh(db_rekening)
    return db_rekening

@app.get("/keluarga/{keluarga_id}/rekening", response_model=List[schemas.RekeningResponse])
def get_rekening_by_keluarga(keluarga_id: int, db: Session = Depends(get_db)):
    return db.query(models.Rekening).filter(models.Rekening.keluarga_id == keluarga_id).all()

# --- Transaksi Endpoints ---
@app.post("/transaksi/", response_model=schemas.TransaksiResponse)
def create_transaksi(transaksi: schemas.TransaksiCreate, db: Session = Depends(get_db)):
    # Verify rekening
    rekening = db.query(models.Rekening).filter(models.Rekening.id == transaksi.rekening_id).first()
    if not rekening:
        raise HTTPException(status_code=404, detail="Rekening not found")
        
    db_transaksi = models.Transaksi(**transaksi.model_dump())
    db.add(db_transaksi)
    
    # Update balance
    if transaksi.type == models.TransaksiTypeEnum.income:
        rekening.balance += transaksi.amount
    elif transaksi.type == models.TransaksiTypeEnum.expense:
        rekening.balance -= transaksi.amount
        
    db.commit()
    db.refresh(db_transaksi)
    return db_transaksi

@app.get("/rekening/{rekening_id}/transaksi", response_model=List[schemas.TransaksiResponse])
def get_transaksi_by_rekening(rekening_id: int, db: Session = Depends(get_db)):
    return db.query(models.Transaksi).filter(models.Transaksi.rekening_id == rekening_id).all()

# --- Dashboard Endpoints ---
@app.get("/keluarga/{keluarga_id}/dashboard")
def get_dashboard_summary(keluarga_id: int, db: Session = Depends(get_db)):
    # Calculate total balance
    rekening_list = db.query(models.Rekening).filter(models.Rekening.keluarga_id == keluarga_id).all()
    total_balance = sum([rek.balance for rek in rekening_list])
    
    # Calculate total income and expense
    from sqlalchemy import func
    
    # Get all members of family
    anggota_ids = [a.id for a in db.query(models.Anggota.id).filter(models.Anggota.keluarga_id == keluarga_id).all()]
    
    if not anggota_ids:
        return {"total_balance": total_balance, "total_income": 0, "total_expense": 0, "recent_transactions": []}
    
    income = db.query(func.sum(models.Transaksi.amount)).filter(
        models.Transaksi.anggota_id.in_(anggota_ids),
        models.Transaksi.type == models.TransaksiTypeEnum.income
    ).scalar() or 0.0
    
    expense = db.query(func.sum(models.Transaksi.amount)).filter(
        models.Transaksi.anggota_id.in_(anggota_ids),
        models.Transaksi.type == models.TransaksiTypeEnum.expense
    ).scalar() or 0.0
    
    # Recent transactions
    recent = db.query(models.Transaksi, models.Anggota.name.label("anggota_name")).join(
        models.Anggota, models.Transaksi.anggota_id == models.Anggota.id
    ).filter(
        models.Transaksi.anggota_id.in_(anggota_ids)
    ).order_by(models.Transaksi.date.desc()).limit(5).all()
    
    recent_formatted = []
    for t, a_name in recent:
        t_dict = schemas.TransaksiResponse.model_validate(t).model_dump()
        t_dict["anggota_name"] = a_name
        recent_formatted.append(t_dict)
    
    return {
        "total_balance": total_balance,
        "total_income": income,
        "total_expense": expense,
        "recent_transactions": recent_formatted
    }

# --- Laporan Endpoints ---
from fastapi.responses import StreamingResponse
import io
import csv

@app.get("/keluarga/{keluarga_id}/laporan")
def get_laporan_bulanan(keluarga_id: int, month: int, year: int, anggota_id: int = None, db: Session = Depends(get_db)):
    if anggota_id:
        anggota_ids = [anggota_id]
    else:
        anggota_ids = [a.id for a in db.query(models.Anggota.id).filter(models.Anggota.keluarga_id == keluarga_id).all()]
        
    if not anggota_ids:
        return []

    import calendar
    _, last_day = calendar.monthrange(year, month)
    
    start_date = datetime(year, month, 1)
    end_date = datetime(year, month, last_day, 23, 59, 59)
    
    query = db.query(models.Transaksi, models.Anggota.name.label("anggota_name")).join(
        models.Anggota, models.Transaksi.anggota_id == models.Anggota.id
    ).filter(
        models.Transaksi.anggota_id.in_(anggota_ids),
        models.Transaksi.date >= start_date,
        models.Transaksi.date <= end_date
    )
    
    transactions = query.order_by(models.Transaksi.date.desc()).all()
    
    formatted = []
    for t, a_name in transactions:
        t_dict = schemas.TransaksiResponse.model_validate(t).model_dump()
        t_dict["anggota_name"] = a_name
        formatted.append(t_dict)
        
    return formatted

@app.get("/keluarga/{keluarga_id}/laporan/export")
def export_laporan_csv(keluarga_id: int, month: int, year: int, anggota_id: int = None, db: Session = Depends(get_db)):
    if anggota_id:
        anggota_list = db.query(models.Anggota).filter(models.Anggota.keluarga_id == keluarga_id, models.Anggota.id == anggota_id).all()
    else:
        anggota_list = db.query(models.Anggota).filter(models.Anggota.keluarga_id == keluarga_id).all()
        
    anggota_map = {a.id: a.name for a in anggota_list}
    
    if not anggota_map:
        raise HTTPException(status_code=404, detail="Keluarga tidak memiliki anggota")

    import calendar
    _, last_day = calendar.monthrange(year, month)
    
    start_date = datetime(year, month, 1)
    end_date = datetime(year, month, last_day, 23, 59, 59)
    
    transactions = db.query(models.Transaksi).filter(
        models.Transaksi.anggota_id.in_(list(anggota_map.keys())),
        models.Transaksi.date >= start_date,
        models.Transaksi.date <= end_date
    ).order_by(models.Transaksi.date.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    
    # Write header
    writer.writerow(["Tanggal", "Anggota", "Jenis", "Kategori", "Nominal", "Keterangan"])
    
    # Write rows
    for t in transactions:
        nama_anggota = anggota_map.get(t.anggota_id, "Unknown")
        writer.writerow([
            t.date.strftime("%Y-%m-%d %H:%M:%S"),
            nama_anggota,
            "Pemasukan" if t.type == models.TransaksiTypeEnum.income else "Pengeluaran",
            t.category,
            t.amount,
            t.description or ""
        ])
    
    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="laporan_keuangan_{year}_{month:02d}.csv"'
    }
    
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)


