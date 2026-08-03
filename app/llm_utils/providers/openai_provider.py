import openai

class OpenAIProvider:
    def __init__(self, model):
        openai.api_key = model.api_key
        self.model_name = model.name

    def generate(self, prompt):
        completion = openai.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7
        )
        return completion.choices[0].message.content
