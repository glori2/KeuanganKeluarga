import psycopg2

DATABASE_URL = "postgresql://postgres.yfhwpmtnnxwsozokhrmj:Muhmasru0808%23@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"

def check_db():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        cur.execute("SELECT COUNT(*) FROM keluarga;")
        k_count = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM anggota;")
        a_count = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM rekening;")
        r_count = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM transaksi;")
        t_count = cur.fetchone()[0]
        
        print("=== DATA DI SUPABASE SAAT INI ===")
        print(f"Total Keluarga : {k_count}")
        print(f"Total Anggota  : {a_count}")
        print(f"Total Rekening : {r_count}")
        print(f"Total Transaksi: {t_count}")
        
        if a_count > 0:
            print("\nDaftar Anggota:")
            cur.execute("SELECT name, telegram_id FROM anggota;")
            for row in cur.fetchall():
                print(f"- {row[0]} (ID: {row[1]})")
                
    except Exception as e:
        print("Error:", e)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    check_db()
