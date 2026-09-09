import os 

from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

def get_groq_llm():

    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise ValueError("GROQ_API_KEY is not set in the environment.")

    return ChatGroq(
        model="openai/gpt-oss-120b",
        temperature=0,
        groq_api_key=api_key
    )