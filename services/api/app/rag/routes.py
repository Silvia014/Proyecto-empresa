from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from data.pipelines.rag import query

router = APIRouter(prefix="/knowledge", tags=["Knowledge base"])


class KnowledgeQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class KnowledgeAnswer(BaseModel):
    answer: str


@router.post("/query", response_model=KnowledgeAnswer)
def ask_knowledge_base(request: KnowledgeQuestion) -> KnowledgeAnswer:
    try:
        return KnowledgeAnswer(answer=query(request.question.strip()))
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="The knowledge assistant is temporarily unavailable.") from exc
