import logging
from database import SessionLocal, engine
import models

# Setup logging
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
            balance=500000.0,
            type=models.RekeningTypeEnum.cash
        )
        db.add(rekening)
        db.commit()
        db.refresh(rekening)
        logger.info(f"Created Rekening: {rekening.name} (ID: {rekening.id}) with initial balance")
    
    # Check if Anggota exists
    anggota = db.query(models.Anggota).filter(models.Anggota.keluarga_id == keluarga.id).first()
    if not anggota:
        anggota = models.Anggota(
            keluarga_id=keluarga.id,
            name="Admin Keluarga",
            role=models.RoleEnum.admin,
            # Placeholder, the user needs to update this with their actual telegram ID later,
            # or the bot can auto-link the first person to message it.
        )
        db.add(anggota)
        db.commit()
        db.refresh(anggota)
        logger.info(f"Created Anggota: {anggota.name} (ID: {anggota.id})")
        
    db.close()
    logger.info("Database seeding completed.")

if __name__ == "__main__":
    seed_data()
