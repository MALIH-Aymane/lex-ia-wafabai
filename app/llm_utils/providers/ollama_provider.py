import requests

class OllamaProvider:
    def __init__(self, model):
        self.endpoint = model.endpoint or "http://localhost:11434/api/generate"
        self.model_name = model.name
        self.api_key = getattr(model, 'api_key', None) or ''

    def _is_openai_compatible(self) -> bool:
        """Return True when endpoint is OpenAI-compatible (e.g. NiceGPU, LM Studio, vLLM)."""
        return '/v1/chat/completions' in self.endpoint or '/v1/' in self.endpoint

    def generate(self, prompt: str) -> str:
        headers = {}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        headers['Content-Type'] = 'application/json'

        if self._is_openai_compatible():
            # Use OpenAI-compatible format
            payload = {
                "model": self.model_name,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False
            }
            endpoint = self.endpoint  # use as-is
        else:
            # Use native Ollama /api/generate format
            payload = {"model": self.model_name, "prompt": prompt, "stream": False}
            endpoint = self.endpoint

        print("payload : ==> ", {**payload, "messages": "..."} if "messages" in payload else payload)
        print("endpoint : ==> ", endpoint)
        print("modelname : ==> ", self.model_name)

        resp = requests.post(endpoint, json=payload, headers=headers, timeout=120)
        print("response : ==> ", resp)

        if not resp.ok:
            resp.raise_for_status()

        data = resp.json()

        # OpenAI-compatible response format
        if "choices" in data:
            return data["choices"][0]["message"]["content"]
        # Native Ollama response format
        return data.get("response", "")
