import logging
from database import SessionLocal
import models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_data():
    db = SessionLocal()
    
    # Check if Keluarga exists
    keluarga = db.query(models.Keluarga).first()
    if not keluarga:
        keluarga = models.Keluarga(name="Keluarga Utama")
        db.add(keluarga)
        db.commit()
        db.refresh(keluarga)
        logger.info(f"Created Keluarga: {keluarga.name} (ID: {keluarga.id})")
    
    # Check if Rekening exists
    rekening = db.query(models.Rekening).filter(models.Rekening.keluarga_id == keluarga.id).first()
    if not rekening:
        rekening = models.Rekening(
            keluarga_id=keluarga.id,
            name="Dompet Utama",
            balance=0.0,
            type=models.RekeningTypeEnum.cash
        )
        db.add(rekening)
        db.commit()
        logger.info(f"Created Rekening: {rekening.name}")
    
    # Check if members exist
    if db.query(models.Anggota).count() == 0:
        db.add_all([
            models.Anggota(keluarga_id=keluarga.id, name="Masruri", telegram_id="884906190", role=models.RoleEnum.admin),
            models.Anggota(keluarga_id=keluarga.id, name="Muh Masruri - 08562896918", telegram_id="45528063", role=models.RoleEnum.member),
            models.Anggota(keluarga_id=keluarga.id, name="Rianita - 085600003918", telegram_id=None, role=models.RoleEnum.member),
            models.Anggota(keluarga_id=keluarga.id, name="Muh Masruri - 08112642340", telegram_id=None, role=models.RoleEnum.member),
        ])
        db.commit()
        logger.info("Seeded 4 members.")
        
    db.close()
    logger.info("Database seeding completed.")

if __name__ == "__main__":
    seed_data()
