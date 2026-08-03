from flask import Flask , jsonify
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import yaml
import os
from datetime import timedelta

# Local imports
from utils.extensions import db
from webservice.questionsws import question_ws
from webservice.documentsws import document_ws
from webservice.recherchews import recherche_ws
from webservice.dashboard_ws import dashboard_ws
from webservice.jurisprudence_ws import jurisprudence_ws
from webservice.authws import authws
from webservice.llm_model_ws import llm_model_ws
from webservice.userws import user_ws
from config.config import Config
from models.role import Role
from models.model import Model
from models.user import User
from models.revoked_token import TokenBlocklist
from models.vector_collection import VectorCollection
from models.otp import PasswordResetOTP

bcrypt = Bcrypt()
jwt = JWTManager()


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload):
    """Return True if token is revoked"""
    jti = jwt_payload["jti"]
    token = db.session.query(TokenBlocklist.id).filter_by(jti=jti).scalar()
    return token is not None


@jwt.revoked_token_loader
def revoked_token_callback(jwt_header, jwt_payload):
    return (
        jsonify({"msg": "Token has been revoked"}),
        401,
    )


@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return (
        jsonify({"msg": "Token has expired"}),
        401,
    )


@jwt.invalid_token_loader
def invalid_token_callback(error):
    return (
        jsonify({"msg": "Invalid token"}),
        422,
    )


@jwt.unauthorized_loader
def missing_token_callback(error):
    return (
        jsonify({"msg": "Missing authorization header"}),
        401,
    )

def create_app():
    app = Flask(__name__)

    # Load database configuration
    db_config = yaml.safe_load(open('database.yaml'))

    # Flask configuration
    app.config.from_object(Config)
    app.config['SQLALCHEMY_DATABASE_URI'] = db_config['uri']
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_ALGORITHM'] = 'HS256'
    app.config['JWT_SECRET_KEY'] = 'MFIAPP2024'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=7)

    # Initialize extensions
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    # Global CORS handling
    CORS(app, resources={r"/*": {
        "origins": "*",
        "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }})

    @app.after_request
    def after_request(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return response

    # Register blueprints
    app.register_blueprint(question_ws, url_prefix='/api/question')
    app.register_blueprint(authws, url_prefix='/api/auth')
    app.register_blueprint(document_ws, url_prefix='/api/documents')
    app.register_blueprint(recherche_ws, url_prefix='/api/recherche')
    app.register_blueprint(llm_model_ws, url_prefix='/api/llm_models')
    app.register_blueprint(user_ws, url_prefix='/api/user')
    app.register_blueprint(dashboard_ws, url_prefix='/api/dashboard')
    app.register_blueprint(jurisprudence_ws, url_prefix='/api/jurisprudence')

    app.config['DEBUG'] = True
    app.debug = True
    # Environment variable for transformers cache
    os.environ['TRANSFORMERS_CACHE'] = '/code'

    # Database initialization and default data
    with app.app_context():
        db.create_all()
        try:
            db.session.execute(db.text("ALTER TABLE user ADD COLUMN avatar VARCHAR(255) NULL"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        try:
            db.session.execute(db.text("ALTER TABLE documents ADD COLUMN grouping VARCHAR(255) NULL"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        try:
            db.session.execute(db.text("ALTER TABLE documents ADD COLUMN collection_name VARCHAR(255) NULL"))
            db.session.commit()
        except Exception:
            db.session.rollback()
        initialize_roles_and_users()
        initialize_vector_collections()

    return app


def initialize_roles_and_users():
    """Create predefined roles and users if not already present."""

    predefined_roles = [
        {
            "name": "Administrateur",
            "description": "Ce rôle dispose de tous les droits d'administration, y compris la gestion des utilisateurs, la configuration du système et l'accès à toutes les fonctionnalités."
        },
        {
            "name": "Responsable juridique",
            "description": "Ce rôle est dédié à la gestion des aspects juridiques, tels que la validation de la jurisprudence."
        },
        {
            "name": "Utilisateur",
            "description": "Ce rôle représente les utilisateurs finaux avec des droits limités selon leur profil."
        }
    ]

    for role_data in predefined_roles:
        if not Role.query.filter_by(name=role_data["name"]).first():
            role = Role(name=role_data["name"], description=role_data["description"])
            db.session.add(role)

    db.session.commit()

    users_data = [
        {
            "username": "admin@example.com",
            "firstname": "Admin",
            "lastname": "Root",
            "email": "admin@example.com",
            "password": "admin123",
            "role_name": "Administrateur"
        },
        {
            "username": "juriste@example.com",
            "firstname": "Legal",
            "lastname": "Expert",
            "email": "juriste@example.com",
            "password": "legal123",
            "role_name": "Responsable juridique"
        },
        {
            "username": "user@example.com",
            "firstname": "Basic",
            "lastname": "User",
            "email": "user@example.com",
            "password": "user123",
            "role_name": "Utilisateur"
        }
    ]

    for user_data in users_data:
        if not User.query.filter_by(username=user_data["username"]).first():
            role = Role.query.filter_by(name=user_data["role_name"]).first()
            if role:
                user = User(
                    username=user_data["username"],
                    firstname=user_data["firstname"],
                    lastname=user_data["lastname"],
                    email=user_data["email"],
                    role_id=role.id
                )
                user.set_password(user_data["password"])
                db.session.add(user)

    db.session.commit()

    print("[OK] Roles and default users initialized successfully.")


def initialize_vector_collections():
    """Populate default collections mapping to embedding models and ensure they exist in ChromaDB."""
    default_cols = [
        {
            "name": "loi-maroc-2025",
            "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
            "description": "Textes de lois du Maroc indexés pour l'année 2025."
        },
        {
            "name": "lex-ia-total",
            "embedding_model": "google/embeddinggemma-300m",
            "description": "Base totale d'indexation pour l'assistant LEX-IA."
        },
        {
            "name": "Jurispridance_marocaine",
            "embedding_model": "google/embeddinggemma-300m",
            "description": "Base de données de jurisprudence validée par les juristes."
        }
    ]

    for col in default_cols:
        if not VectorCollection.query.filter_by(name=col["name"]).first():
            new_col = VectorCollection(
                name=col["name"],
                embedding_model=col["embedding_model"],
                description=col["description"]
            )
            db.session.add(new_col)
    
    db.session.commit()
    print("[OK] Default Vector Collections initialized in SQL.")

    # Synchronize and pre-create all SQL collections in ChromaDB
    try:
        from utils.chroma_client_manager import get_chroma_collection
        all_cols = VectorCollection.query.all()
        for col in all_cols:
            print(f"[INFO] Ensuring ChromaDB collection '{col.name}' exists...")
            get_chroma_collection(col.name)
        print("[OK] ChromaDB collections synchronized successfully.")
    except Exception as e:
        print(f"[WARN] Warning: Could not synchronize ChromaDB collections during startup: {e}")


if __name__ == "__main__":
    app = create_app()
    port = 5000
    host = os.getenv('HOST', '0.0.0.0')
    app.run(host=host, port=port, debug=True)
