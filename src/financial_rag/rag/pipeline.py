from financial_rag.embeddings.model import embedding_model
from financial_rag.llm.router import generate_response
from financial_rag.cache.cache import get_cached_answer, save_answer
from financial_rag.vectorstore.qdrant import qdrant_client, COLLECTION_NAME




# --> Retrieval

def retrieve_chunks(query: str, top_k: int = 5):

    query_embedding = embedding_model.encode(
        query,
        normalize_embeddings=True
    ).tolist()

    results = qdrant_client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_embedding,
        limit=top_k,
        with_payload=True,
    )

    return results.points


# --> Format retrieved context

def format_context(results):

    context_parts = []

    for i, result in enumerate(results, start=1):

        payload = result.payload

        context_parts.append(
            f"""SOURCE {i}
Document: {payload.get('document')}
Section: {payload.get('section')}
Chunk ID: {payload.get('chunk_id')}
Content:
{payload.get('text')}
"""
        )

    return "\n\n".join(context_parts)


# --> Build RAG prompt

def build_rag_prompt(question, context):

    return f"""
You are a financial policy assistant for Northstar Financial.

Answer the user's question using ONLY the policy context provided below.

Rules:
1. Do not use outside knowledge.
2. Do not invent policy rules, limits, authorities, or exceptions.
3. If the context does not contain enough information to answer confidently, say:
"I could not find sufficient support for this answer in the provided policies."
4. When multiple policies are relevant, consider all of them.
5. Preserve exact monetary amounts, thresholds, authority levels, and conditions.
6. Give a concise explanation.
7. Cite the relevant source document and section in your answer.

POLICY CONTEXT:
----------------
{context}
----------------

USER QUESTION:
{question}

ANSWER:
"""


# --> Complete RAG + Cache pipeline

def answer_question(question, top_k=5):

    # 1. Check cache first
    cached = get_cached_answer(question)

    if cached:

        answer, provider, sources, frequency = cached

        print("Cache HIT — skipping retrieval and LLM.")

        return {
            "question": question,
            "answer": answer,
            "provider": provider,
            "sources": sources,
            "frequency": frequency,
            "results": [],
            "cached": True,
        }

    # 2. Cache miss
    print("Cache MISS — running retrieval and LLM.")

    results = retrieve_chunks(
        question,
        top_k=top_k
    )

    context = format_context(results)

    prompt = build_rag_prompt(
        question=question,
        context=context
    )

    answer, provider = generate_response(prompt)

    # 3. Collect sources
    source_list = []

    for result in results:

        payload = result.payload

        source = (
            f"{payload.get('document')} | "
            f"{payload.get('section')}"
        )

        if source not in source_list:
            source_list.append(source)

    sources = "\n".join(source_list)

    # 4. Save answer to cache
    save_answer(
        question=question,
        answer=answer,
        provider=provider,
        sources=sources,
    )

    # 5. Return result
    return {
        "question": question,
        "answer": answer,
        "provider": provider,
        "sources": sources,
        "frequency": 1,
        "results": results,
        "cached": False,
    }