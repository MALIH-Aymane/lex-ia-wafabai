from utils.extensions import db

class LLMModel(db.Model):
    __tablename__ = "llm_models"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)  # e.g. "gpt-4o-mini", "mistral"
    provider = db.Column(db.String(50), nullable=False)            # "openai", "ollama", "gemini", "deepseek"
    endpoint = db.Column(db.String(255), nullable=True)            # custom API base (optional)
    api_key = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    is_default = db.Column(db.Boolean, default=False)
    temperature = db.Column(db.Float, default=0.7)
    max_tokens = db.Column(db.Integer, default=2048)

    def as_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "provider": self.provider,
            "endpoint": self.endpoint,
            "is_active": self.is_active,
            "is_default": self.is_default,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens
        }

