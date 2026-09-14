from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
import enum
import datetime
import database

class RoleEnum(str, enum.Enum):
    admin = "admin"
    member = "member"

class RekeningTypeEnum(str, enum.Enum):
    bank = "bank"
    cash = "cash"
    ewallet = "ewallet"

class TransaksiTypeEnum(str, enum.Enum):
    income = "income"
    expense = "expense"
    transfer = "transfer"

class Keluarga(database.Base):
    __tablename__ = "keluarga"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    anggota = relationship("Anggota", back_populates="keluarga")
    rekening = relationship("Rekening", back_populates="keluarga")

class Anggota(database.Base):
    __tablename__ = "anggota"
    id = Column(Integer, primary_key=True, index=True)
    keluarga_id = Column(Integer, ForeignKey("keluarga.id"))
    name = Column(String)
    telegram_id = Column(String, unique=True, index=True, nullable=True)
    role = Column(Enum(RoleEnum), default=RoleEnum.member)
    
    keluarga = relationship("Keluarga", back_populates="anggota")
    transaksi = relationship("Transaksi", back_populates="anggota")

class Rekening(database.Base):
    __tablename__ = "rekening"
    id = Column(Integer, primary_key=True, index=True)
    keluarga_id = Column(Integer, ForeignKey("keluarga.id"))
    name = Column(String)
    balance = Column(Float, default=0.0)
    type = Column(Enum(RekeningTypeEnum), default=RekeningTypeEnum.cash)
    
    keluarga = relationship("Keluarga", back_populates="rekening")
    transaksi = relationship("Transaksi", back_populates="rekening")

class Transaksi(database.Base):
    __tablename__ = "transaksi"
    id = Column(Integer, primary_key=True, index=True)
    rekening_id = Column(Integer, ForeignKey("rekening.id"))
    anggota_id = Column(Integer, ForeignKey("anggota.id"))
    amount = Column(Float)
    type = Column(Enum(TransaksiTypeEnum))
    category = Column(String, index=True)
    description = Column(String, nullable=True)
    date = Column(DateTime, default=datetime.datetime.utcnow)
    
    rekening = relationship("Rekening", back_populates="transaksi")
    anggota = relationship("Anggota", back_populates="transaksi")
