from google.api_core.exceptions import GoogleAPIError

from financial_rag.llm.gemini import get_gemini_llm
from financial_rag.llm.groq import get_groq_llm


def extract_text(response) -> str:
    """Extract plain text from a LangChain model response."""

    if isinstance(response.content, str):
        return response.content

    if isinstance(response.content, list):
        text_parts = []

        for item in response.content:
            if isinstance(item, dict) and item.get("type") == "text":
                text_parts.append(item.get("text", ""))

        return "\n".join(text_parts)

    return str(response.content)


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

        return extract_text(response), "gemini"

    except (GoogleAPIError, TimeoutError, ConnectionError) as gemini_error:
        print(f"Gemini failed: {gemini_error}")
        print("Falling back to Groq...")

        groq = get_groq_llm()

        response = groq.invoke(prompt)

        return extract_text(response), "groq"