import logging
from uuid import UUID
from fastapi.responses import JSONResponse
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .graph import get_run_trace, run_agent

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agent", tags=["Knowledge agent"])


class AgentQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class AgentResult(BaseModel):
    run_id: str
    answer: str | None = None
    error: str | None = None
    trace: list[dict] = Field(default_factory=list)
    status: str


@router.post("/query", response_model=AgentResult)
def ask_agent(request: AgentQuestion) -> AgentResult:
    try:
        result = run_agent(request.question)
    except Exception as exc:
        logger.exception("Agent graph execution failed")
        raise HTTPException(
            status_code=502,
            detail="The knowledge agent could not complete the request.",
        ) from exc

    if result["status"] == "invalid":
        return JSONResponse(status_code=400, content=result)

    if result["status"] == "failure":
         return JSONResponse(status_code=502, content=result)
    
    return AgentResult(**result)


@router.get("/traces/{run_id}")
def read_agent_trace(run_id: str) -> dict:
    try:
        UUID(run_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid run_id.") from exc

    trace = get_run_trace(run_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found.")

    return {"run_id": run_id, "trace": trace}