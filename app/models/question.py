from utils.extensions import db
from models.document import Langue
from datetime import datetime
from enum import Enum  # NEW


class Status(Enum):  # NEW
    NORMAL = "Normal"
    SENT_TO_EXPERT = "Sent to expert"
    JURISPRUDENCE = "Jurisprudence"   # (correct spelling)

class Question(db.Model):
    __tablename__ = "questions"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    texte = db.Column(db.Text)
    user = db.Column(db.String(255))
    filters = db.Column(db.Text)
    langue = db.Column(db.Enum(Langue), nullable=False)

    # NEW: status enum with default = Normal
    status = db.Column(
        db.Enum(Status),
        nullable=False,
        default=Status.NORMAL,                    # Python-side default
        server_default=Status.NORMAL.value        # DB-side default
    )

    def __init__(self, date, texte, user, filters, langue, status: Status = Status.NORMAL):
        self.date = date
        self.texte = texte
        self.user = user
        self.filters = filters
        self.langue = langue
        self.status = status

    def __repr__(self):
        # NOTE: removed undefined attributes document_id/model_id to avoid AttributeError
        return f'{self.id}/{self.date}/{self.texte}/{self.user}/{self.filters}/{self.langue}/{self.status}'

    def as_dict(self):
        return {
            'id': self.id,
            'date': self.date.strftime('%d/%m/%Y | %H:%M') if self.date else None,
            'texte': self.texte,
            'user': self.user,
            'filters': self.filters,
            'langue': self.langue.value if isinstance(self.langue, Langue) else self.langue,
            'status': self.status.value if isinstance(self.status, Status) else self.status,
        }
