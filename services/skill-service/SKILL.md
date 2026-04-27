# Skill Service

AI capability catalog management for the RamVector enterprise platform.

---

## What It Does

The Skill Service manages the **enterprise AI skill catalog** — a registry of AI capabilities (e.g. "Conversational NLP Pipeline", "Invoice Vision Extractor"). Each skill goes through a review/approval/deploy lifecycle, and tracks real AI performance metrics: **accuracy score** and **latency**.

---

## Run Locally

```bash
cd services/skill-service
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8002 --reload
```

API docs: http://localhost:8002/docs  
Health check: http://localhost:8002/health

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/skill_db` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379/1` | Redis cache (DB index 1) |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | Event bus |
| `PORT` | `8002` | Service port |
| `GROQ_API_KEY` | _(empty)_ | Primary LLM provider |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq model |
| `NVIDIA_API_KEY` | _(empty)_ | Fallback LLM provider |
| `CEREBRAS_API_KEY` | _(empty)_ | Second fallback LLM |

> LLM falls back: **Groq → NVIDIA → Cerebras → Mock** (mock is used if all keys are empty)

---

## API Endpoints

Base path: `/api/v1/skill`

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create a new skill |
| `GET` | `/` | List / search skills for an organisation |
| `GET` | `/{skill_id}` | Get a single skill |
| `POST` | `/{skill_id}/submit-review` | Submit skill for review |
| `POST` | `/{skill_id}/approve` | Approve a skill |
| `POST` | `/{skill_id}/deploy` | Deploy an approved skill |
| `PATCH` | `/{skill_id}/metrics` | Update accuracy & latency metrics |
| `DELETE` | `/{skill_id}` | Deprecate a skill |

### List / Search
Add `?search=nlp` to search by keyword.  
Filter by `?category=nlp`, `?status=deployed`.

---

## Skill Lifecycle

```
DRAFT → UNDER_REVIEW → APPROVED → DEPLOYED
                                 ↘ DEPRECATED
```

- Skills start as **Draft**
- Author submits for review → **Under Review**
- Admin approves → **Approved**
- Admin deploys → **Deployed** (live in production)
- Any status can be deprecated via `DELETE /{skill_id}`

---

## Data Model

### Skill Categories
| Value | Meaning |
|---|---|
| `nlp` | Natural Language Processing |
| `computer_vision` | Image / video understanding |
| `data_analysis` | Data querying & analytics |
| `reasoning` | Logic and decision making |
| `code_generation` | Code writing & review |
| `multimodal` | Mixed input types |
| `agent` | Autonomous AI agents |
| `custom` | Organisation-specific |

### Proficiency Levels
`beginner` → `intermediate` → `advanced` → `expert`

### Key Fields
| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique skill ID |
| `name` | string | Skill name (2–200 chars) |
| `description` | string | What the skill does (10–2000 chars) |
| `category` | enum | See categories above |
| `status` | enum | draft / under_review / approved / deployed / deprecated |
| `proficiency_level` | enum | beginner / intermediate / advanced / expert |
| `organization_id` | UUID | Organisation this skill belongs to |
| `created_by` | UUID | User who created the skill |
| `tags` | string[] | Free-form labels (e.g. `["nlp", "intent"]`) |
| `accuracy_score` | float | 0.0–1.0, set via `/metrics` endpoint |
| `latency_ms` | float | Response time in milliseconds |
| `usage_count` | int | Number of times the skill has been invoked |
| `metadata` | object | Any extra key-value data |

---

## Example Requests

**Create a skill**
```bash
curl -X POST http://localhost:8002/api/v1/skill \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Conversational NLP Pipeline",
    "description": "Production-grade NLP pipeline for intent detection and entity extraction.",
    "category": "nlp",
    "organization_id": "123e4567-e89b-12d3-a456-426614174000",
    "created_by": "223e4567-e89b-12d3-a456-426614174000",
    "proficiency_level": "advanced",
    "tags": ["nlp", "intent", "entity-extraction"]
  }'
```

**Update metrics after evaluation**
```bash
curl -X PATCH http://localhost:8002/api/v1/skill/{skill_id}/metrics \
  -H "Content-Type: application/json" \
  -d '{"accuracy_score": 0.94, "latency_ms": 180}'
```

---

## Dependencies

- FastAPI + Uvicorn
- PostgreSQL (asyncpg + SQLAlchemy)
- Redis (caching)
- RabbitMQ (event publishing via aio-pika)
- Groq / NVIDIA / Cerebras SDK (LLM providers)
