from google.api_core.exceptions import GoogleAPIError

from financial_rag.llm.gemini import get_gemini_llm
from financial_rag.llm.groq import get_groq_llm


def generate_response(prompt: str) -> tuple[str, str]:
    """
    Generate a response using Gemini first.
    Fall back to Groq if Gemini fails.

    Returns:
        tuple[str, str]: (response_text, provider)
    """

    try:
        gemini = get_gemini_llm()

        response = gemini.invoke(prompt)

        return response.content, "gemini"

    except (GoogleAPIError, TimeoutError, ConnectionError) as gemini_error:
        print(f"Gemini failed: {gemini_error}")
        print("Falling back to Groq...")

        groq = get_groq_llm()

        response = groq.invoke(prompt)

        return response.content, "groq"