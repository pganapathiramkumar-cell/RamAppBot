# Steer Service

Strategic AI goal management for the RamVector enterprise platform.

---

## What It Does

The Steer Service lets organisations create and track **strategic AI goals** (e.g. "Achieve 90% model accuracy by Q3"). Each goal gets an **AI alignment score** (0–1) computed by the AI Orchestrator, showing how well the goal aligns with the broader enterprise AI strategy.

---

## Run Locally

```bash
cd services/steer-service
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload
```

API docs: http://localhost:8001/docs  
Health check: http://localhost:8001/health

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/steer_db` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis cache |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | Event bus |
| `PORT` | `8001` | Service port |
| `GROQ_API_KEY` | _(empty)_ | Primary LLM provider |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq model |
| `NVIDIA_API_KEY` | _(empty)_ | Fallback LLM provider |
| `CEREBRAS_API_KEY` | _(empty)_ | Second fallback LLM |

> LLM falls back: **Groq → NVIDIA → Cerebras → Mock** (mock is used if all keys are empty)

---

## API Endpoints

Base path: `/api/v1/steer`

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create a new goal |
| `GET` | `/` | List goals for an organisation |
| `GET` | `/{goal_id}` | Get a single goal |
| `PATCH` | `/{goal_id}` | Update goal fields |
| `POST` | `/{goal_id}/activate` | Move goal from Draft → Active |
| `POST` | `/{goal_id}/complete` | Move goal from Active → Completed |

---

## Goal Lifecycle

```
DRAFT → ACTIVE → COMPLETED
              ↘ PAUSED
              ↘ ARCHIVED
```

- Goals start as **Draft**
- Call `/activate` to make them live
- Call `/complete` when the goal is achieved

---

## Data Model

### Goal Types
| Value | Meaning |
|---|---|
| `strategic` | Enterprise-wide AI direction |
| `operational` | Day-to-day AI guidance |
| `compliance` | Governance & regulatory |
| `innovation` | R&D and experimentation |

### Priority Levels
`critical` → `high` → `medium` → `low`

### Key Fields
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique goal ID |
| `title` | string | Short goal name (3–200 chars) |
| `description` | string | Full description (10–2000 chars) |
| `goal_type` | enum | strategic / operational / compliance / innovation |
| `priority` | enum | critical / high / medium / low |
| `status` | enum | draft / active / paused / completed / archived |
| `owner_id` | UUID | User who owns the goal |
| `organization_id` | UUID | Organisation this goal belongs to |
| `ai_alignment_score` | float | 0.0–1.0, computed by AI Orchestrator |
| `success_criteria` | string[] | Up to 10 measurable criteria |
| `target_date` | datetime | Optional deadline |
| `is_overdue` | bool | True if active and past target_date |

---

## Example Request

```bash
curl -X POST http://localhost:8001/api/v1/steer \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Achieve 90% AI Model Accuracy",
    "description": "Ensure all production AI models meet 90% accuracy threshold by Q3.",
    "goal_type": "strategic",
    "priority": "high",
    "owner_id": "123e4567-e89b-12d3-a456-426614174000",
    "organization_id": "223e4567-e89b-12d3-a456-426614174000",
    "target_date": "2026-09-30T00:00:00Z",
    "success_criteria": ["Model accuracy >= 90%", "Latency < 200ms"]
  }'
```

---

## Dependencies

- FastAPI + Uvicorn
- PostgreSQL (asyncpg + SQLAlchemy)
- Redis (caching)
- RabbitMQ (event publishing via aio-pika)
- Groq / NVIDIA / Cerebras SDK (LLM providers)
