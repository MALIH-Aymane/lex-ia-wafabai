from utils.extensions import db

class VectorCollection(db.Model):
    __tablename__ = "vector_collections"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    embedding_model = db.Column(db.String(512), nullable=False, default="google/embeddinggemma-300m")
    description = db.Column(db.String(1024), nullable=True)

    def __init__(self, name, embedding_model, description=None):
        self.name = name
        self.embedding_model = embedding_model
        self.description = description

    def __repr__(self):
        return f"<VectorCollection {self.name} ({self.embedding_model})>"

    def as_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "embedding_model": self.embedding_model,
            "description": self.description
        }
