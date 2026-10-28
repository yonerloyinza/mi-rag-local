import sys
import time
from sqlalchemy import text

from database import engine, Base, SessionLocal


def wait_for_db():
    for _ in range(5):
        try:
            conn = engine.connect()
            conn.close()
            return True
        except Exception:
            print("Esperando a que la base de datos esté lista...")
            time.sleep(2)
    print("No se pudo conectar a la base de datos.")
    return False


def create_extensions():
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()


def reset_database():
    if not wait_for_db():
        return

    create_extensions()
    print("Extension 'vector' habilitada o ya existente.")

    Base.metadata.drop_all(bind=engine)
    print("Tablas eliminadas.")

    Base.metadata.create_all(bind=engine)
    print("Tabla 'document_chunks' creada con éxito.")


def init_database():
    if not wait_for_db():
        return

    create_extensions()
    print("Extension 'vector' habilitada o ya existente.")

    Base.metadata.create_all(bind=engine)
    print("Tabla 'document_chunks' creada con éxito.")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "init"
    if mode == "reset":
        reset_database()
    else:
        init_database()
