from models.llm_model import LLMModel
from llm_utils.providers.openai_provider import OpenAIProvider
from llm_utils.providers.ollama_provider import OllamaProvider
from llm_utils.providers.gemini_provider import GeminiProvider
from llm_utils.providers.deepseek_provider import DeepSeekProvider

class LLMRouter:
    def __init__(self):
        self.providers = {
            "openai": OpenAIProvider,
            "ollama": OllamaProvider,
            "gemini": GeminiProvider,
            "deepseek": DeepSeekProvider
        }

    def get_model(self, model_name: str = None):
        if not model_name:
            model = LLMModel.query.filter_by(is_active=True, is_default=True).first()
            if not model:
                model = LLMModel.query.filter_by(is_active=True).first()
            if not model:
                raise ValueError("No active LLM model configured in the database.")
            return model
        model = LLMModel.query.filter_by(name=model_name, is_active=True).first()
        if not model:
            # Fallback to default active model or first active model
            model = LLMModel.query.filter_by(is_active=True, is_default=True).first()
            if not model:
                model = LLMModel.query.filter_by(is_active=True).first()
            if not model:
                raise ValueError(f"Model '{model_name}' not found or inactive, and no active fallback model exists.")
        return model

    def generate(self, model_name: str, prompt: str):
        model = self.get_model(model_name)
        provider_class = self.providers.get(model.provider)
        if not provider_class:
            raise ValueError(f"No provider found for '{model.provider}'.")

        provider = provider_class(model)
        return provider.generate(prompt)
