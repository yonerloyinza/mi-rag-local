import os
import hashlib
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, func, event, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.dialects.postgresql import TSVECTOR, ARRAY
from pgvector.sqlalchemy import Vector

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
VAULT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'vault')
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(VAULT_DIR, exist_ok=True)

def generate_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def get_file_paths(filename: str, content: bytes = None, is_note: bool = False) -> tuple:
    ext = filename.split('.')[-1].lower() if '.' in filename else 'txt'
    if is_note and ext != 'md':
        ext = 'md'
    if content:
        file_hash = generate_file_hash(content)
    else:
        file_hash = generate_file_hash(filename.encode())
    subdir1 = file_hash[:2]
    subdir2 = file_hash[2:4]
    base_dir = VAULT_DIR if is_note else UPLOAD_DIR
    full_dir = os.path.join(base_dir, subdir1, subdir2)
    os.makedirs(full_dir, exist_ok=True)
    hashed_filename = f"{file_hash}.{ext}" if ext else file_hash
    return os.path.join(full_dir, hashed_filename), file_hash, ext

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False, unique=True, index=True)
    type = Column(String, default="note", nullable=False)
    file_path = Column(String, nullable=True)
    file_hash = Column(String, nullable=True, index=True)
    original_filename = Column(String, nullable=True)
    tags = Column(ARRAY(String), default=[])
    rag_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False, index=True)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=False)
    type = Column(String, default="note")
    tags = Column(ARRAY(String), default=[])
    rag_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    search_vector = Column(TSVECTOR, nullable=True)

    document = relationship("Document", back_populates="chunks")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    eval_score = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@event.listens_for(engine, "connect")
def do_connect(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    cursor.close()
