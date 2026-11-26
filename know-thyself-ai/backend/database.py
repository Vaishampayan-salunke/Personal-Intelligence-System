import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

db_url = settings.DATABASE_URL
# Handle postgresql schema compatibility if deployed on Render, Supabase, or Heroku
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif db_url.startswith("postgresql://") and not (db_url.startswith("postgresql+psycopg") or db_url.startswith("postgresql+psycopg2")):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(db_url, connect_args=connect_args)

if db_url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from app.models import user, record, goal, insight, nudge, chat
    Base.metadata.create_all(bind=engine)
    # Clean up any orphaned user preferences from prior runs if any
    with engine.connect() as conn:
        try:
            conn.execute(
                Base.metadata.tables["user_preferences"].delete().where(
                    ~Base.metadata.tables["user_preferences"].c.user_id.in_(
                        Base.metadata.tables["users"].select().with_only_columns(Base.metadata.tables["users"].c.id)
                    )
                )
            )
            conn.commit()
        except Exception:
            pass
