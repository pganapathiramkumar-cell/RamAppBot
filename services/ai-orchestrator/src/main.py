"""AI Orchestrator — FastAPI Application."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"[AI Orchestrator] Starting — model: {settings.OLLAMA_MODEL} @ {settings.OLLAMA_BASE_URL}")
    yield
    print("[AI Orchestrator] Shutting down")


app = FastAPI(title="Rambot AI Orchestrator", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-orchestrator", "model": settings.OLLAMA_MODEL}


@app.post("/api/v1/orchestrate/steer/analyze")
async def analyze_steer(body: dict):
    from src.agents.steer_agent import SteerAgent
    agent = SteerAgent(base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL)
    result = await agent.analyze_strategic_goals(
        organization_id=body.get("organization_id", ""),
        goals=body.get("goals", []),
        user_question=body.get("question", "Summarize our AI strategic posture"),
    )
    return {"analysis": result}


@app.post("/api/v1/orchestrate/skill/gap-analysis")
async def skill_gap_analysis(body: dict):
    from src.agents.skill_agent import SkillAgent
    agent = SkillAgent(base_url=settings.OLLAMA_BASE_URL, model=settings.OLLAMA_MODEL)
    result = await agent.analyze_skill_gaps(
        organization_id=body.get("organization_id", ""),
        steer_goals=body.get("steer_goals", []),
        current_skills=body.get("current_skills", []),
    )
    return {"gap_analysis": result}
