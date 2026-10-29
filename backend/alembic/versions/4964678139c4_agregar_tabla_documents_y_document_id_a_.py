"""agregar_tabla_documents_y_document_id_a_chunks

Revision ID: 4964678139c4
Revises: ff769120a3a6
Create Date: 2026-10-28 23:23:21.161643

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector
from sqlalchemy import text

revision: str = '4964678139c4'
down_revision: Union[str, Sequence[str], None] = 'ff769120a3a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer, primary_key=True, index=True),
        sa.Column('filename', sa.String, nullable=False, unique=True, index=True),
        sa.Column('type', sa.String, default='note', nullable=False),
        sa.Column('file_path', sa.String, nullable=True),
        sa.Column('tags', sa.ARRAY(sa.String), default=[]),
        sa.Column('rag_enabled', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('now()'),
                  onupdate=sa.text('now()')),
    )

    conn = op.get_bind()
    conn.execute(text("ALTER TABLE document_chunks ADD COLUMN document_id INTEGER"))

    existing = conn.execute(text(
        "SELECT filename, type, tags, rag_enabled, created_at FROM document_chunks WHERE filename IS NOT NULL"
    )).fetchall()

    seen = {}
    for row in existing:
        fname = row[0]
        if fname not in seen:
            doc_type = row[1] or 'note'
            doc_tags = row[2] or []
            doc_rag = row[3] if row[3] is not None else True
            doc_created = row[4]
            conn.execute(text(
                "INSERT INTO documents (filename, type, file_path, tags, rag_enabled, created_at) "
                "VALUES (:filename, :type, :file_path, :tags, :rag_enabled, :created_at)"
            ).params(
                filename=fname, type=doc_type, file_path=None,
                tags=doc_tags, rag_enabled=doc_rag, created_at=doc_created
            ))
            doc_id = conn.execute(
                text("SELECT id FROM documents WHERE filename = :f").params(f=fname)
            ).scalar()
            seen[fname] = doc_id

        doc_id = seen[fname]
        conn.execute(text(
            "UPDATE document_chunks SET document_id = :doc_id WHERE filename = :fname"
        ).params(doc_id=doc_id, fname=fname))

    conn.execute(text("ALTER TABLE document_chunks ALTER COLUMN document_id SET NOT NULL"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_document', 'document_chunks', type_='foreignkey')
    op.drop_column('document_chunks', 'document_id')
    op.drop_table('documents')
