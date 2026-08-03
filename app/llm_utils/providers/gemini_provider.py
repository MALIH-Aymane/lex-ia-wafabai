import google.generativeai as genai

class GeminiProvider:
    def __init__(self, model):
        genai.configure(api_key=model.api_key)
        self.model_name = model.name

    def generate(self, prompt):
        model = genai.GenerativeModel(self.model_name)
        response = model.generate_content(prompt)
        return response.text
