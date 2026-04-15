# Rambot Enterprise Architecture Overview

## 🎯 What is Rambot?

**Rambot** is an **AI Strategic Platform** for enterprises to manage AI initiatives through three core pillars:
- **Steer**: Strategic AI goal management, alignment scoring, dependency analysis
- **Skill**: AI capability catalog, skill proficiency tracking, gap analysis  
- **DocuMind**: Intelligent document processing (PDF → Analysis via OLLAMA)

---

## 📐 System Architecture

```
CLIENT LAYER
┌──────────────┐              ┌───────────────────┐
│  Web App     │              │  Mobile App       │
│  Next.js     │              │  React Native     │
│  Port :3000  │              │  iOS/Android      │
└──────┬───────┘              └─────────┬─────────┘
       │ HTTPS/JWT                      │ HTTPS/JWT
       └────────────┬─────────────────┬──┘
                    │ REST/WebSocket  │
            ┌───────▼────────────────▼───────┐
            │  API GATEWAY (FastAPI)         │
            │  Port :8000                    │
            │  • JWT Auth Middleware         │
            │  • Rate Limiting               │
            │  • Request Routing             │
            └───────┬───────┬────────┬───────┘
                    │       │        │
        ┌───────────┼───────┼────┬───┴───────┐
        │           │       │    │           │
   ┌────▼────┐ ┌────▼──┐ ┌─▼────┐ ┌──────▼──┐
   │  Steer  │ │ Skill │ │ Auth │ │Document │
   │ :8001   │ │ :8002 │ │:8003 │ │ :8006   │
   └────┬────┘ └────┬──┘ └─┬────┘ └──────┬──┘
        │           │      │             │
        │      ┌────▼──────▼─────────┬───┘
        │      │  AI Orchestrator   │
        │      │  Port :8004        │
        │      │  (OLLAMA LLM)      │
        │      └────┬───────────────┘
        │           │      Notification
        │           │      Service
        │           │      Port :8005
        └───────────┼──────┬────────┘
                    │      │
            ┌───────▼──────▼──────┐
            │  PostgreSQL (3 DBs) │
            │  Port :5432         │
            │  • steer_db         │
            │  • skill_db         │
            │  • auth_db          │
            └─────────────────────┘

        ┌──────────────┐  ┌──────────────┐
        │  Redis       │  │  RabbitMQ    │
        │  Port :6379  │  │  Port :5672  │
        │  (Cache)     │  │  (Events)    │
        └──────────────┘  └──────────────┘
```

---

## 🔧 Backend Services

### **API Gateway (:8000)**
- **Purpose**: Single entry point for all clients
- **Responsibilities**:
  - JWT authentication middleware
  - Route requests to downstream services
  - Rate limiting & CORS
  - Logging & monitoring
- **No database**: Pure routing/proxy

### **Auth Service (:8003)**
- **Purpose**: User identity & token management
- **Database**: `auth_db` (PostgreSQL)
- **Key Data**: Users, organizations, roles
- **Operations**:
  - Login (email/password → JWT)
  - Register new users
  - Token refresh
  - Role-based access control (super_admin, org_admin, ai_architect, analyst, viewer)
- **Token Format**: JWT with `sub`, `org_id`, `email`, `roles`, `exp`

### **Steer Service (:8001)**
- **Purpose**: Strategic AI goal management
- **Database**: `steer_db` (PostgreSQL)
- **Cache**: Redis DB 1 (alignment scores, TTL: 1h)
- **Key Entities**:
  ```
  SteerGoal
  ├─ title, description
  ├─ goal_type: strategic | operational | compliance | innovation
  ├─ priority: critical | high | medium | low
  ├─ status: draft → active → paused | completed | archived
  ├─ ai_alignment_score: 0.0-1.0 (computed by AI)
  ├─ success_criteria: []
  └─ dependencies: goal-to-goal relationships
  ```
- **State Machine**:
  - DRAFT → ACTIVE → PAUSED | COMPLETED
  - ARCHIVED (from ACTIVE or COMPLETED)
- **Operations**:
  - CRUD operations
  - State transitions (activate, complete, pause)
  - AI alignment analysis (calls AI Orchestrator)
  - Dependency impact analysis
- **Events Published** (RabbitMQ):
  - SteerGoalCreated
  - SteerGoalActivated
  - SteerGoalCompleted
  - SteerGoalAlignmentUpdated

### **Skill Service (:8002)**
- **Purpose**: AI capability catalog & gap analysis
- **Database**: `skill_db` (PostgreSQL)
- **Cache**: Redis DB 2 (deployed skills, TTL: 24h)
- **Key Entities**:
  ```
  Skill
  ├─ name, description
  ├─ category: nlp | cv | data_analysis | reasoning | code_gen | multimodal | agent | custom
  ├─ status: draft → under_review → approved → deployed | deprecated
  ├─ proficiency_level: beginner | intermediate | advanced | expert
  ├─ accuracy_score: 0.0-1.0
  ├─ latency_ms: response time
  ├─ usage_count: adoption tracking
  ├─ versions: [version history]
  └─ metadata: custom properties
  ```
- **Workflow**:
  - DRAFT → UNDER_REVIEW → APPROVED → DEPLOYED
  - REJECTED (from UNDER_REVIEW)
  - DEPRECATED (from DEPLOYED)
- **Operations**:
  - Create/update skills
  - Submit for review workflow
  - Deploy to production
  - Gap analysis (compare current vs. required)
  - Roadmap recommendations
- **Events Published**:
  - SkillCreated
  - SkillDeployed
  - SkillDeprecated
  - SkillMetricsUpdated

### **Document Service (:8006)**
- **Purpose**: PDF ingestion & RAG-based AI analysis
- **Database**: Document metadata (PostgreSQL)
- **Storage**: In-memory (dev) / S3 (prod)
- **Pipeline**:
  1. User uploads PDF
  2. Validate (type, size, non-empty)
  3. Store file
  4. Return 202 Accepted (async processing)
  5. **Background Processing** (async task):
     - Extract text from PDF
     - Run 3 AI chains in parallel via OLLAMA:
       - **SUMMARY**: 200-word executive summary
       - **ACTIONS**: Structured action items (JSON)
       - **WORKFLOW**: Recommended process steps
  6. Store results in database
  7. Update status to "done"
- **Status Workflow**: uploading → processing → done (or failed)
- **API Endpoints**:
  - POST `/api/v1/documents/upload` → Upload PDF
  - GET `/api/v1/documents/{id}` → Get metadata
  - GET `/api/v1/documents/{id}/analysis` → Get AI results
  - GET `/api/v1/documents/{id}/download` → Download PDF

### **AI Orchestrator (:8004)**
- **Purpose**: LLM orchestration via OLLAMA
- **Model**: Llama 3.2 (local, no API keys)
- **Technology**: Function calling loops (agent pattern)
- **Key Agents**:
  - **SteerAgent**: Strategic goal analysis
    - Fetches org AI maturity
    - Analyzes goal dependencies
    - Benchmarks against industry standards
    - Tools: `get_organization_ai_maturity`, `analyze_goal_dependencies`, `benchmark_against_industry`
  
  - **SkillAgent**: Skill gap analysis
    - Maps skills to org goals
    - Identifies missing capabilities
    - Priorities by impact
    - Recommends acquisition path (build/buy/partner)
- **Processing Flow**:
  1. Receive context (org_id, goals/skills, question)
  2. Load additional context from services (HTTP calls)
  3. Format system prompt + context
  4. Call Llama via OLLAMA
  5. If Llama calls tool: execute → return result → loop
  6. Once final answer reached: return analysis
  7. Cache result (Redis, TTL: 1h)

### **Notification Service (:8005)**
- **Purpose**: Event-driven notifications
- **Integration**: RabbitMQ consumer
- **Channels**:
  - Push notifications (FCM - Firebase Cloud Messaging)
  - Email (SMTP, can integrate with SendGrid/SES)
  - In-app (WebSocket or polling)
- **Listens to Events**:
  - `SteerGoalCreated` → Notify goal owner
  - `SteerGoalAlignmentUpdated` → Alert stakeholders (if score changed >10%)
  - `SkillDeployed` → Announce new capability
  - `DocumentAnalysisComplete` → Notify user

---

## 💾 Data Layer

### **PostgreSQL (Port 5432)**
Three separate databases per service isolation pattern:

**auth_db:**
```
users (id, email, hashed_password, organization_id, role, status, ...)
organizations (id, name, industry, ...)
```

**steer_db:**
```
steer_goals (id, title, description, goal_type, priority, status, 
             ai_alignment_score, target_date, success_criteria, ...)
steer_goal_dependencies (goal_id_1, goal_id_2, dependency_type)
```

**skill_db:**
```
skills (id, name, category, status, proficiency_level, accuracy_score, 
        latency_ms, usage_count, metadata, ...)
skill_versions (skill_id, version, changelog, released_at)
skill_dependencies (skill_id, depends_on_skill_id)
```

**document_db (implicit):**
```
documents (id, user_id, filename, file_size, status, storage_path, ...)
document_analyses (id, document_id, summary, action_points, workflow, ...)
```

### **Redis (Port 6379)**
Separate DBs per service:
```
DB 0: API Gateway sessions, rate limits
DB 1: Steer service cache (alignment scores, TTL: 1h)
DB 2: Skill service cache (deployed skills, TTL: 24h)
DB 3: Auth service cache (JWT blacklist, sessions, TTL: varies)
DB 4: AI Orchestrator cache (analysis results, TTL: 1h)
```

### **RabbitMQ (Ports 5672, 15672 UI)**
Event-driven messaging:
```
Exchange: rambot.events (fanout)
├─ Queue: steer-events → Steer Service
├─ Queue: skill-events → Skill Service
├─ Queue: notifications → Notification Service
└─ Queue: audit-events → Audit/Logging

Key Events:
- steer_goal_created
- steer_goal_activated
- steer_goal_alignment_updated
- skill_deployed
- skill_metrics_updated
- document_analysis_complete
```

---

## 🔄 Key Data Flows

### **Flow 1: User Login → Protected API Call**
```
1. User logs in (email, password)
2. POST /api/v1/auth/login → API Gateway → Auth Service
3. Auth Service validates credentials, returns JWT
4. Client stores token (localStorage)
5. For next requests: Authorization: "Bearer <JWT>"
6. API Gateway validates JWT signature
7. Extracts user_id, org_id from token
8. Routes to downstream service
9. Service uses org_id for data scoping (multi-tenancy)
```

### **Flow 2: Upload PDF → Get Analysis**
```
1. User selects PDF in web/mobile app
2. POST /api/v1/documents/upload → API Gateway → Document Service
3. Document Service:
   - Validates file
   - Stores PDF
   - Returns 202 Accepted (with document_id)
   - Background task starts async processing
4. Background Processing:
   - Extract text from PDF (PyPDF2)
   - Split into chunks
   - Run AI chains via OLLAMA:
     • SUMMARY chain
     • ACTIONS chain
     • WORKFLOW chain
   - Save results to database
   - Update status to "done"
5. Client polls: GET /api/v1/documents/{doc_id}
   - If status = "processing" → Keep polling (2-3s intervals)
   - If status = "done" → Display summary, actions, workflow
```

### **Flow 3: Calculate Steer Goal Alignment**
```
1. Client requests: POST /api/v1/steer/ai/analyze
2. Steer Service receives goal(s), question
3. Steer Service calls AI Orchestrator endpoint
4. AI Orchestrator:
   - Creates SteerAgent instance
   - Calls Llama with function calling
   - Llama might invoke tools:
     • get_organization_ai_maturity()
     • analyze_goal_dependencies()
     • benchmark_against_industry()
   - Returns structured analysis with alignment_score
5. Steer Service:
   - Receives analysis from AI Orchestrator
   - Optionally streams to client (WebSocket/SSE)
   - Saves to database
   - Publishes RabbitMQ event: SteerGoalAlignmentUpdated
6. Notification Service:
   - Receives event
   - If score changed >10%: Send push notification
7. Client receives real-time update or polls for latest score
```

### **Flow 4: Event-Driven Notifications**
```
1. Service publishes event to RabbitMQ:
   Example: SkillDeployed
   {
     "skill_id": "skill-123",
     "skill_name": "NLP Model v2",
     "deployed_by": "user-456"
   }
2. Notification Service consumes event from queue
3. Notification Service:
   - Looks up interested users (skill followers, admins)
   - Generates message: "NLP Model v2 deployed!"
   - Sends via preferred channel:
     • Push notification (FCM)
     • Email
     • In-app (WebSocket)
4. User receives notification (mobile push, email, etc.)
```

---

## 🚀 Frontend Applications

### **Web App (Next.js, Port 3000)**
**Technology:**
- Framework: Next.js 14 + React 18
- Styling: Tailwind CSS
- State: Redux Toolkit + React Query
- Forms: React Hook Form + Zod
- UI Lib: Lucide icons, Recharts, Mermaid

**Features:**
- `/steer` → Goal management dashboard
- `/skill` → Skill catalog browser
- `/documents` → DocuMind file upload & results
- Authentication (login/register)
- Multi-tenant UI (org scoping)

**Architecture:**
- Feature-sliced design (`src/features/steer/`, `src/features/skill/`)
- API client with JWT interceptor
- React Query for server state
- Redux for app state

### **Mobile App (React Native + Expo)**
**Technology:**
- Runtime: Expo 54 + React Native 0.81
- Navigation: Expo Router (file-based)
- UI: React Navigation (tabs), Expo Vector Icons
- Animations: React Native Reanimated

**Features:**
- Tab-based navigation
- Document upload/download
- Goal and skill browsing
- Push notifications via FCM

**Platform Support:** iOS + Android

---

## 🏗️ Infrastructure

### **Local Development (Docker Compose)**
Start all services with:
```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

Services running:
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- RabbitMQ: `localhost:5672` (UI: `localhost:15672`)
- API Gateway: `localhost:8000`
- Steer Service: `localhost:8001`
- Skill Service: `localhost:8002`
- Auth Service: `localhost:8003`
- AI Orchestrator: `localhost:8004`
- Document Service: `localhost:8006`
- Notification Service: `localhost:8005`
- Web App: `localhost:3000`
- Mobile App: Expo dev server + tunnel

### **OLLAMA Setup (Required for AI)**
```bash
# Download from https://ollama.ai
# Run locally
ollama pull llama3.2
ollama serve  # Runs on http://localhost:11434

# Environment variables
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### **Production (Kubernetes + AWS)**
- **Compute**: EKS (Elastic Kubernetes Service)
- **Database**: AWS RDS (PostgreSQL Multi-AZ)
- **Cache**: AWS ElastiCache (Redis cluster mode)
- **Message Broker**: AWS MQ (RabbitMQ) or self-hosted in K8s
- **Document Storage**: S3 + CloudFront CDN
- **Monitoring**: CloudWatch + DataDog
- **Infrastructure as Code**: Terraform (modules for EKS, RDS, ElastiCache, S3)

---

## 🔐 Authentication & Authorization

**Model:** JWT-based with role-based access control (RBAC)

**Roles:**
- `super_admin` → Full platform access, manage organizations
- `org_admin` → Manage organization users, settings
- `ai_architect` → Create/modify goals and skills
- `analyst` → View and comment on goals/skills
- `viewer` → Read-only access

**Token Claims:**
```json
{
  "sub": "<user_id>",
  "org_id": "<organization_id>",
  "email": "<email>",
  "roles": ["ai_architect"],
  "exp": 1702483200,
  "iat": 1702396800
}
```

**Multi-Tenancy:**
- All queries scoped by `organization_id`
- JWT contains org_id
- API Gateway validates org_id matches request

---

## 📊 Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend (Web)** | Next.js + React + TailwindCSS | Web UI |
| **Frontend (Mobile)** | React Native + Expo | iOS/Android apps |
| **API Gateway** | FastAPI + Python | Request routing, auth |
| **Services** | FastAPI + Python | Business logic |
| **Database** | PostgreSQL | Persistent storage |
| **Cache** | Redis | Session, caching |
| **Message Queue** | RabbitMQ | Event-driven architecture |
| **LLM** | OLLAMA (Llama 3.2) | AI/reasoning |
| **Orchestration (Dev)** | Docker Compose | Local services |
| **Orchestration (Prod)** | Kubernetes (EKS) | Production deployment |
| **Infrastructure as Code** | Terraform | AWS provisioning |
| **Monitoring** | Prometheus, CloudWatch | Observability |

---

## 🎯 Deployment Checklist

### **Local Dev Setup**
- [ ] Clone monorepo
- [ ] Install Node.js, Python 3.11+
- [ ] Install Docker & Docker Compose
- [ ] Download & run OLLAMA (`ollama serve`)
- [ ] Create `.env` from `.env.example`
- [ ] Start services: `docker-compose up -d`
- [ ] Start web app: `npm run dev` (port 3000)
- [ ] Start mobile app: `npx expo start`

### **Environment Variables (Minimal for OLLAMA)**
```bash
# AI
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Database
POSTGRES_DB=rambot
POSTGRES_USER=rambot_user
POSTGRES_PASSWORD=rambot_pass

# Auth
JWT_SECRET=your-dev-secret-key

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### **Production Deployment (AWS EKS)**
- [ ] Set up AWS account & EKS cluster (via Terraform)
- [ ] Create RDS PostgreSQL instance (Multi-AZ, automated backups)
- [ ] Create ElastiCache Redis (cluster mode)
- [ ] Configure S3 bucket for documents
- [ ] Build Docker images for each service
- [ ] Push images to ECR (Elastic Container Registry)
- [ ] Deploy to EKS (via helm charts or kubectl)
- [ ] Set up monitoring (CloudWatch, DataDog)
- [ ] Configure CI/CD pipeline (GitHub Actions)
- [ ] Set up SSL/TLS (AWS Certificate Manager)

---

## 🔍 Critical Paths (for Testing)

1. **End-to-End (E2E) User Flow**:
   - User registers
   - User logs in
   - User creates a Steer goal
   - System calls AI Orchestrator for alignment analysis
   - User receives push notification
   - Goal appears on dashboard

2. **Document Processing Pipeline**:
   - Upload PDF
   - Verify file stored correctly
   - Poll for processing status
   - Verify AI chains ran (summary, actions, workflow generated)
   - Display results on frontend

3. **Multi-Tenancy**:
   - User from Org A can't see data from Org B
   - JWT org_id scoping works correctly
   - Database queries filtered by org_id

4. **Event-Driven Notifications**:
   - Publish event to RabbitMQ
   - Notification Service consumes
   - User receives push/email/in-app

---

**Last Updated:** April 15, 2026  
**Tech Stack:** FastAPI, React, React Native, PostgreSQL, Redis, RabbitMQ, OLLAMA, Kubernetes, Terraform
