"""agregar tablas de autenticacion, roles y permisos

Revision ID: 9f3c1a7b2d4e
Revises: eb9abba415d1
Create Date: 2026-10-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f3c1a7b2d4e'
down_revision: Union[str, Sequence[str], None] = 'eb9abba415d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(name)


def _has_column(table: str, column: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return column in {col['name'] for col in inspector.get_columns(table)}


def upgrade() -> None:
    """Crea el esquema de autenticación si aún no existe.

    Las comprobaciones permiten aplicar esta migración a bases de datos donde
    las tablas ya fueron creadas manualmente, sin destruir datos existentes.
    """
    if not _has_table('user_roles'):
        op.create_table(
            'user_roles',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=50), nullable=False),
            sa.Column('description', sa.String(length=255), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_user_roles_id'), 'user_roles', ['id'], unique=False)
        op.create_index(op.f('ix_user_roles_name'), 'user_roles', ['name'], unique=True)

    if not _has_table('permissions'):
        op.create_table(
            'permissions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('description', sa.String(length=255), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_permissions_id'), 'permissions', ['id'], unique=False)
        op.create_index(op.f('ix_permissions_name'), 'permissions', ['name'], unique=True)

    if not _has_table('role_permissions'):
        op.create_table(
            'role_permissions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('role_id', sa.Integer(), nullable=False),
            sa.Column('permission_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(
                ['permission_id'], ['permissions.id'],
                name='role_permissions_permission_id_fkey', ondelete='CASCADE',
            ),
            sa.ForeignKeyConstraint(
                ['role_id'], ['user_roles.id'],
                name='role_permissions_role_id_fkey', ondelete='CASCADE',
            ),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_role_permissions_id'), 'role_permissions', ['id'], unique=False)

    if not _has_table('users'):
        op.create_table(
            'users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('username', sa.String(length=100), nullable=False),
            sa.Column('password_hash', sa.String(length=255), nullable=False),
            sa.Column('full_name', sa.String(length=255), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
            sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.Column('role_id', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(
                ['role_id'], ['user_roles.id'], name='users_role_id_fkey',
            ),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
        op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    if not _has_table('document_shares'):
        op.create_table(
            'document_shares',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('document_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column(
                'permission_level', sa.String(length=20), nullable=False,
                server_default='read',
            ),
            sa.Column('shared_by_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
            sa.ForeignKeyConstraint(
                ['document_id'], ['documents.id'],
                name='document_shares_document_id_fkey', ondelete='CASCADE',
            ),
            sa.ForeignKeyConstraint(
                ['shared_by_id'], ['users.id'],
                name='document_shares_shared_by_id_fkey',
            ),
            sa.ForeignKeyConstraint(
                ['user_id'], ['users.id'],
                name='document_shares_user_id_fkey', ondelete='CASCADE',
            ),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_document_shares_id'), 'document_shares', ['id'], unique=False)
        op.create_index(op.f('ix_document_shares_document_id'), 'document_shares', ['document_id'], unique=False)
        op.create_index(op.f('ix_document_shares_user_id'), 'document_shares', ['user_id'], unique=False)

    if not _has_column('documents', 'owner_id'):
        op.add_column('documents', sa.Column('owner_id', sa.Integer(), nullable=True))
        op.create_index(op.f('ix_documents_owner_id'), 'documents', ['owner_id'], unique=False)
        op.create_foreign_key(
            'documents_owner_id_fkey', 'documents', 'users', ['owner_id'], ['id'],
        )

    # Roles y permisos base (idempotente).
    op.execute(
        """
        INSERT INTO user_roles (name, description) VALUES
            ('user', 'Usuario estándar'),
            ('admin', 'Administrador')
        ON CONFLICT (name) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO permissions (name, description) VALUES
            ('documents:read', 'Leer documentos propios o compartidos'),
            ('documents:write', 'Crear y editar documentos propios o compartidos'),
            ('documents:delete', 'Eliminar documentos propios'),
            ('users:manage', 'Administrar usuarios y roles')
        ON CONFLICT (name) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM user_roles r
        JOIN permissions p ON p.name IN (
            'documents:read', 'documents:write', 'documents:delete'
        )
        WHERE r.name = 'user'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )
    op.execute(
        """
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM user_roles r
        JOIN permissions p ON p.name IN (
            'documents:read', 'documents:write', 'documents:delete', 'users:manage'
        )
        WHERE r.name = 'admin'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )
    op.execute(
        """
        UPDATE users
        SET role_id = (
            SELECT id FROM user_roles
            WHERE name = CASE WHEN users.is_admin THEN 'admin' ELSE 'user' END
        )
        WHERE role_id IS NULL
        """
    )


def downgrade() -> None:
    """Elimina el esquema de autenticación."""
    if _has_table('document_shares'):
        op.drop_table('document_shares')

    if _has_table('documents') and _has_column('documents', 'owner_id'):
        op.drop_index(op.f('ix_documents_owner_id'), table_name='documents')
        op.drop_constraint('documents_owner_id_fkey', 'documents', type_='foreignkey')
        op.drop_column('documents', 'owner_id')

    if _has_table('users'):
        op.drop_table('users')
    if _has_table('role_permissions'):
        op.drop_table('role_permissions')
    if _has_table('permissions'):
        op.drop_table('permissions')
    if _has_table('user_roles'):
        op.drop_table('user_roles')
