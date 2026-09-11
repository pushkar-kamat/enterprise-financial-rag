import hashlib
import sys
from pathlib import Path

import streamlit as st

PROJECT_ROOT = Path(__file__).resolve().parent
SRC_PATH = PROJECT_ROOT / "src"

if str(SRC_PATH) not in sys.path:
    sys.path.append(str(SRC_PATH))

from financial_rag.cache.cache import get_frequently_asked_questions
from financial_rag.rag.pipeline import answer_question
from financial_rag.ingestion.ingest import ingest_document


def get_file_hash(file):
    return hashlib.sha256(file.getvalue()).hexdigest()


st.set_page_config(
    page_title="Northstar Financial AI",
    page_icon="🏦",
    layout="wide",
)

st.title("Northstar Financial AI")

st.subheader("Upload a policy document")

uploaded_file = st.file_uploader(
    "Upload PDF, DOCX, TXT, CSV, XLSX, or Markdown",
    type=["pdf", "docx", "txt", "csv", "xlsx", "md"],
)

if uploaded_file is not None:

    extension = Path(uploaded_file.name).suffix.lower()

    extension_to_folder = {
        ".pdf": "pdf",
        ".docx": "docx",
        ".txt": "txt",
        ".md": "markdown",
        ".markdown": "markdown",
        ".csv": "csv",
        ".xlsx": "excel",
        ".xls": "excel",
    }

    folder_name = extension_to_folder.get(extension)

    if folder_name is None:
        st.error("Unsupported file type.")
        st.stop()

    file_hash = get_file_hash(uploaded_file)

    if st.session_state.get("last_ingested_file_hash") != file_hash:

        raw_dir = PROJECT_ROOT / "data" / "raw" / folder_name
        raw_dir.mkdir(parents=True, exist_ok=True)

        file_path = raw_dir / uploaded_file.name

        with open(file_path, "wb") as f:
            f.write(uploaded_file.getbuffer())

        with st.spinner("Indexing document..."):
            try:
                result = ingest_document(file_path)

                st.session_state["last_ingested_file_hash"] = file_hash

                st.success(
                    f"Document indexed successfully: "
                    f"{result['chunk_count']} chunks created."
                )

            except Exception as e:
                st.error(f"Document indexing failed: {e}")

    else:
        st.info("This document has already been indexed in this session.")


st.subheader("Ask a question")

question = st.text_input(
    "Enter your question about Northstar Financial policies:"
)

if st.button("Ask", type="primary"):

    if question.strip():
        result = answer_question(question)

        st.session_state["selected_faq"] = {
            "question": question,
            "answer": result["answer"],
            "provider": result["provider"],
            "frequency": result["frequency"],
            "sources": result["sources"],
        }


st.subheader("Frequently Asked Questions")

faqs = get_frequently_asked_questions(limit=5)

if not faqs:
    st.info("No frequently asked questions yet.")
else:
    for index, (faq_question, faq_answer, provider, frequency) in enumerate(faqs):

        button_label = f"{faq_question} ({frequency}x)"

        if st.button(
            button_label,
            key=f"faq_{index}",
            use_container_width=True,
        ):
            st.session_state["selected_faq"] = {
                "question": faq_question,
                "answer": faq_answer,
                "provider": provider,
                "frequency": frequency,
            }


if "selected_faq" in st.session_state:

    selected = st.session_state["selected_faq"]

    st.divider()
    st.subheader("Answer")
    st.write(selected["answer"])

    if selected.get("sources"):
        with st.expander("View sources"):
            st.text(selected["sources"])

    st.caption(
        f"Provider: {selected['provider']} • "
        f"Asked: {selected['frequency']}x"
    )