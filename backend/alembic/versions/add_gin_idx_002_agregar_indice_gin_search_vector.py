"""agregar_indice_gin_search_vector

Revision ID: add_gin_idx_002
Revises: 5b5a84dd02e0
Create Date: 2026-10-28 08:06:55.530815

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector


# revision identifiers, used by Alembic.
revision: str = 'add_gin_idx_002'
down_revision: Union[str, Sequence[str], None] = '5b5a84dd02e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(
        'ix_document_chunks_search_vector',
        'document_chunks',
        ['search_vector'],
        unique=False,
        postgresql_using='gin'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_search_vector;")
