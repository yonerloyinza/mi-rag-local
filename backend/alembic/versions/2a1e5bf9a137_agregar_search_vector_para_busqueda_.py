"""agregar_search_vector_para_busqueda_hibrida

Revision ID: 2a1e5bf9a137
Revises: 45acf0e21b69
Create Date: 2026-10-28 01:11:42.429629

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector


# revision identifiers, used by Alembic.
revision: str = '2a1e5bf9a137'
down_revision: Union[str, Sequence[str], None] = '45acf0e21b69'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Alembic agregará la columna automáticamente
    op.add_column('document_chunks', sa.Column('search_vector', sa.dialects.postgresql.TSVECTOR(), nullable=True))

    # 2. Creamos un índice GIN manual para que las búsquedas por texto sean ultra rápidas
    op.create_index('ix_document_chunks_search_vector', 'document_chunks', ['search_vector'], unique=False, postgresql_using='gin')

    # 3. Creamos un Trigger en Postgres para que convierta el 'content' a 'tsvector' automáticamente al insertar
    op.execute("""
        CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
        ON document_chunks FOR EACH ROW EXECUTE FUNCTION
        tsvector_update_trigger(search_vector, 'pg_catalog.spanish', content);
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS tsvectorupdate ON document_chunks;")
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_search_vector;")
    op.drop_column('document_chunks', 'search_vector')
