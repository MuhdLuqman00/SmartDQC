import logging
import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

logger = logging.getLogger(__name__)

engine = None
SessionLocal = None


def init_db() -> None:
    global engine, SessionLocal

    url = os.environ["DATABASE_URL"]  # Hard fail — no silent fallback
    engine = create_engine(
        url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        pool_recycle=1800,
        connect_args={"options": "-c statement_timeout=300000"},
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    logger.info("Database connection verified.")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
