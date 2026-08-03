import os
from datetime import timedelta

class Config:
    # Existing configurations
    SECRET_KEY = 'Hala_Madrid'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    PERSIST_DIR = "chroma_storage"
    EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
    PDF_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'pdfs')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'LOIMAORC2026-V1'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=2)  # Expiration de l'access token en 2 jour
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)

    # SMTP configurations for Flask-Mail
    MAIL_SERVER = 'ai.casoft.ma'
    MAIL_PORT = 465
    MAIL_USE_SSL = True
    MAIL_USE_TLS = False
    MAIL_USERNAME = 'lex-ia@ai.casoft.ma'
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD') or 'q&-$HLm+1Bb3wHCx'