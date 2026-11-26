import os
import urllib.parse
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

def clean_database_url(url: str) -> str:
    """
    Cleans and standardizes database URL:
    - Normalizes postgres:// and postgresql:// to postgresql+psycopg://
    - Automatically URL-encodes special characters (such as '@' or '#') in passwords
      which otherwise cause 'failed to resolve host' errors.
    """
    if not url:
        return "sqlite:///./know_thyself.db"
    
    clean_url = url.strip()

    # Convert Heroku / old PostgreSQL URLs
    if clean_url.startswith("postgres://"):
        clean_url = clean_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif clean_url.startswith("postgresql://") and not (clean_url.startswith("postgresql+psycopg") or clean_url.startswith("postgresql+psycopg2")):
        clean_url = clean_url.replace("postgresql://", "postgresql+psycopg://", 1)

    if not (clean_url.startswith("postgresql+psycopg://") or clean_url.startswith("postgresql://")):
        return clean_url

    # Split scheme from the rest
    scheme, sep, rest = clean_url.partition("://")
    if not sep:
        return clean_url

    # Separate path & query
    path_idx = rest.find("/")
    if path_idx != -1:
        authority = rest[:path_idx]
        path_and_query = rest[path_idx:]
    else:
        authority = rest
        path_and_query = ""

    # In authority, the LAST '@' separates userinfo from host[:port]
    if "@" in authority:
        last_at_idx = authority.rfind("@")
        userinfo = authority[:last_at_idx]
        host_port = authority[last_at_idx + 1:]

        # In userinfo, the first ':' separates username from password
        if ":" in userinfo:
            user, _, password = userinfo.partition(":")
            # Unquote first to prevent double-encoding, then URL-encode special chars
            unquoted_pw = urllib.parse.unquote(password)
            encoded_pw = urllib.parse.quote(unquoted_pw, safe="")
            userinfo = f"{user}:{encoded_pw}"

        authority = f"{userinfo}@{host_port}"

    return f"{scheme}://{authority}{path_and_query}"

db_url = clean_database_url(settings.DATABASE_URL)

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
    from app.models import user, record, goal, insight, nudge, chat, mobile_device
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
