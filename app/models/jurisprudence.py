from utils.extensions import db
from datetime import datetime
import ast

def _coerce_sources(value):
    """
    Accept list, None, or stringified list and return a Python list of strings.
    """
    if value is None:
        return []
    if isinstance(value, list):
        return [str(x) for x in value]
    if isinstance(value, str):
        s = value.strip()
        if (s.startswith('[') and s.endswith(']')) or (s.startswith('(') and s.endswith(')')):
            try:
                parsed = ast.literal_eval(s)
                if isinstance(parsed, (list, tuple)):
                    return [str(x) for x in parsed]
            except Exception:
                pass
        # treat as single id
        return [s]
    # anything else → stringify
    return [str(value)]


class Jurisprudence(db.Model):
    __tablename__ = "jurisprudences"

    id = db.Column(db.Integer, primary_key=True)

    # FK to the question this response is about
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)

    # ID of the user (provider) who created the response
    provider_id = db.Column(db.Integer, nullable=False)

    # list of Qdrant vector IDs used to generate the response
    # requires MySQL 5.7+/8.0+ or PostgreSQL for native JSON
    sources = db.Column(db.JSON, nullable=False, default=list)

    # timestamps
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow,
                           onupdate=datetime.utcnow, server_onupdate=db.func.now())

    # contents
    content = db.Column(db.Text, nullable=True)        # raw/plain text answer
    html_content = db.Column(db.Text, nullable=True)   # rendered HTML version

    # status of this jurisprudence response (e.g., DRAFT, PUBLISHED, ARCHIVED)
    status = db.Column(db.String(50), nullable=False, default="DRAFT", server_default="DRAFT")

    # relationship back to Question
    question = db.relationship('Question',
                               backref=db.backref('jurisprudences', lazy=True, cascade="all, delete-orphan"))

    def __init__(self, question_id, provider_id, sources=None,
                 content=None, html_content=None, status="DRAFT"):
        self.question_id = question_id
        self.provider_id = provider_id
        self.sources = _coerce_sources(sources)
        self.content = content
        self.html_content = html_content
        self.status = status

    def as_dict(self):
        return {
            "id": self.id,
            "question_id": self.question_id,
            "provider_id": self.provider_id,
            "sources": self.sources or [],
            "created_at": self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            "updated_at": self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None,
            "content": self.content,
            "html_content": self.html_content,
            "status": self.status,
        }

    def __repr__(self):
        return (f"Jurisprudence(id={self.id}, question_id={self.question_id}, "
                f"provider_id={self.provider_id}, sources={self.sources}, "
                f"status='{self.status}', created_at={self.created_at}, updated_at={self.updated_at})")
