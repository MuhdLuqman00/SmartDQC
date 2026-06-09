"""child_record table for durable linkable records

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-09

"""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "child_record",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "dataset_id",
            sa.String(),
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_type", sa.String(), nullable=False),
        sa.Column("ic_norm", sa.String(), nullable=False, default=""),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("dob", sa.String(), nullable=True),
        sa.Column("gender", sa.String(), nullable=True),
        sa.Column("state", sa.String(), nullable=True),
        sa.Column("district", sa.String(), nullable=True),
        sa.Column("measure_date", sa.String(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("height_cm", sa.Float(), nullable=True),
        sa.Column("bmi", sa.Float(), nullable=True),
        sa.Column("waz", sa.Float(), nullable=True),
        sa.Column("haz", sa.Float(), nullable=True),
        sa.Column("baz", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_child_record_dataset_id", "child_record", ["dataset_id"])
    op.create_index("ix_child_record_ic_norm", "child_record", ["ic_norm"])


def downgrade() -> None:
    op.drop_index("ix_child_record_ic_norm", "child_record")
    op.drop_index("ix_child_record_dataset_id", "child_record")
    op.drop_table("child_record")
