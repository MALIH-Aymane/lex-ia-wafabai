import requests

class DeepSeekProvider:
    def __init__(self, model):
        self.endpoint = model.endpoint or "https://api.deepseek.com/v1/chat/completions"
        self.api_key = model.api_key
        self.model_name = model.name

    def generate(self, prompt):
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        data = {
            "model": self.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7
        }
        response = requests.post(self.endpoint, headers=headers, json=data)
        return response.json()["choices"][0]["message"]["content"]
