"""linkage_run and linkage_member tables for audit

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-09

"""

from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "linkage_run",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("params_json", sa.JSON(), nullable=False),
        sa.Column("dataset_ids", sa.JSON(), nullable=False),
        sa.Column("total_groups", sa.Integer(), nullable=False),
        sa.Column("linked_groups", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_table(
        "linkage_member",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "run_id",
            sa.Integer(),
            sa.ForeignKey("linkage_run.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("group_index", sa.Integer(), nullable=False),
        sa.Column("ic_norm", sa.String(), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("dataset_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("dob", sa.String(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("match_reasons", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("linkage_member")
    op.drop_table("linkage_run")
