from flask import Flask, request, jsonify
from bs4 import BeautifulSoup
from deepseek_utils import analyze_content, process_query

app = Flask(__name__)

def extract_main_content(html):
    soup = BeautifulSoup(html, 'html.parser')
    # Remove script and style elements
    for script in soup(["script", "style", "nav", "footer", "header"]):
        script.decompose()
    return soup.get_text(separator='\n', strip=True)

@app.route('/summarize', methods=['POST'])
def handle_summarization():
    html = request.json.get('html')
    text = extract_main_content(html)
    
    # Analyze content domain
    domain = analyze_content(text)
    
    # Generate summary
    summary = process_query(
        f"Summarize this {domain} content in 3-5 key points:\n\n{text[:5000]}"
    )
    return jsonify({
        "summary": summary,
        "domain": domain
    })

@app.route('/ask', methods=['POST'])
def handle_question():
    data = request.json
    question = data.get('question')
    context = data.get('context', '')
    
    # Combine context and question
    prompt = f"Context: {context[:3000]}\n\nQuestion: {question}\nAnswer:"
    
    # Process with appropriate model
    answer = process_query(prompt)
    return jsonify({"answer": answer})
