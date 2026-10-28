"""agregar_tags_y_rag_enabled_a_document_chunks

Revision ID: ceb7a10927d3
Revises: add_gin_idx_002
Create Date: 2026-10-28 10:31:20.002804

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector
from sqlalchemy.dialects.postgresql import ARRAY


# revision identifiers, used by Alembic.
revision: str = 'ceb7a10927d3'
down_revision: Union[str, Sequence[str], None] = 'add_gin_idx_002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('document_chunks', sa.Column('tags', ARRAY(sa.String()), server_default='{}', nullable=False))
    op.add_column('document_chunks', sa.Column('rag_enabled', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('document_chunks', sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('document_chunks', 'updated_at')
    op.drop_column('document_chunks', 'rag_enabled')
    op.drop_column('document_chunks', 'tags')
