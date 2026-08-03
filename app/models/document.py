import uuid
from utils.extensions import db
from enum import Enum


class StatusEnum(Enum):
    ACTIVE = "active"
    NOT_ACTIVE = "not_active"
    UNDER_DEVELOPMENT = "under_development"



class Langue(Enum):
    FR = "fr"
    ENG = "eng"
    AR = "ar"


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255))
    type = db.Column(db.String(255))
    langue = db.Column(db.Enum(Langue), nullable=False)
    date = db.Column(db.Date, nullable=False)
    status = db.Column(db.Enum(StatusEnum), nullable=False)
    ishidden = db.Column(db.Boolean, default=False)
    full_path = db.Column(db.String(1024), nullable=True)  # 🆕 full file path on disk or cloud
    grouping = db.Column(db.String(255), nullable=True)   # 🆕 grouping tag for documents
    collection_name = db.Column(db.String(255), nullable=True) # 🆕 collection_name field

    def __init__(self, name, type, langue, date, status, ishidden=False, full_path=None, grouping=None, collection_name=None):
        self.uuid = str(uuid.uuid4())
        self.name = name
        self.type = type
        self.langue = langue
        self.date = date
        self.status = status
        self.ishidden = ishidden
        self.full_path = full_path
        self.grouping = grouping
        self.collection_name = collection_name

    def __repr__(self):
        return f"<Document {self.name} ({self.uuid})>"

    def as_dict(self):
        return {
            "id": self.id,
            "uuid": self.uuid,
            "name": self.name,
            "type": self.type,
            "langue": self.langue.value if hasattr(self.langue, 'value') else str(self.langue),
            "date": str(self.date) if self.date else None,
            "status": self.status.value if hasattr(self.status, 'value') else str(self.status),
            "ishidden": self.ishidden,
            "full_path": self.full_path,
            "grouping": getattr(self, 'grouping', '') or "",
            "collection_name": getattr(self, 'collection_name', '') or "",
        }
