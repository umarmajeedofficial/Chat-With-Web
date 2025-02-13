import os
from openai import OpenAI

client = OpenAI(
    base_url="https://api.aimlapi.com/v1",
    api_key=os.getenv("DEEPSEEK_API_KEY"),
)

def analyze_content(text):
    response = client.chat.completions.create(
        model="deepseek/deepseek-v3",
        messages=[
            {"role": "system", "content": "Classify this content's domain."},
            {"role": "user", "content": f"Text: {text[:2000]}\n\nDomain category (tech, health, finance, other):"}
        ],
        max_tokens=20
    )
    return response.choices[0].message.content.lower().strip()

def classify_question(query):
    response = client.chat.completions.create(
        model="deepseek/deepseek-v3",
        messages=[
            {"role": "system", "content": "Classify this query as 'critical' or 'general'."},
            {"role": "user", "content": query}
        ],
        max_tokens=20
    )
    return "critical" if "critical" in response.choices[0].message.content.lower() else "general"

def process_query(prompt):
    query_type = classify_question(prompt)
    model = "deepseek/deepseek-r1" if query_type == "critical" else "deepseek/deepseek-chat"
    
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=500
    )
    return response.choices[0].message.content
