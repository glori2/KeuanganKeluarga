from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import models

class KeluargaBase(BaseModel):
    name: str

class KeluargaCreate(KeluargaBase):
    pass

class KeluargaResponse(KeluargaBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class AnggotaBase(BaseModel):
    name: str
    telegram_id: Optional[str] = None
    role: models.RoleEnum = models.RoleEnum.member

class AnggotaCreate(AnggotaBase):
    keluarga_id: int

class AnggotaResponse(AnggotaBase):
    id: int
    keluarga_id: int
    
    class Config:
        from_attributes = True

class RekeningBase(BaseModel):
    name: str
    balance: float = 0.0
    type: models.RekeningTypeEnum = models.RekeningTypeEnum.cash

class RekeningCreate(RekeningBase):
    keluarga_id: int

class RekeningResponse(RekeningBase):
    id: int
    keluarga_id: int
    
    class Config:
        from_attributes = True

class TransaksiBase(BaseModel):
    amount: float
    type: models.TransaksiTypeEnum
    category: str
    description: Optional[str] = None

class TransaksiCreate(TransaksiBase):
    rekening_id: int
    anggota_id: int

class TransaksiResponse(TransaksiBase):
    id: int
    rekening_id: int
    anggota_id: int
    date: datetime
    
    class Config:
        from_attributes = True
