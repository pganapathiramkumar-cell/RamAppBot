# Rambot Enterprise — Architecture Overview

## System Design

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
│  Web (Next.js)  │  iOS (React Native)  │  Android (RN)     │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS/WSS
┌────────────────────────────▼────────────────────────────────┐
│                    API GATEWAY (FastAPI)                     │
│        Auth • Rate Limiting • Routing • Logging             │
└──────┬──────────┬────────────┬──────────┬───────────────────┘
       │          │            │          │
  ┌────▼───┐ ┌───▼────┐ ┌────▼───┐ ┌───▼────────┐
  │ Steer  │ │ Skill  │ │  Auth  │ │  AI Orch.  │
  │Service │ │Service │ │Service │ │  (Claude)  │
  └────┬───┘ └───┬────┘ └────┬───┘ └────────────┘
       │         │           │
  ┌────▼─────────▼───────────▼──────────────────┐
  │              PostgreSQL (per-service DB)     │
  └─────────────────────────────────────────────┘
  ┌───────────────────┐  ┌──────────────────────┐
  │   Redis (Cache)   │  │ RabbitMQ (Events)    │
  └───────────────────┘  └──────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  Notification Svc   │
                         │  FCM (iOS/Android)  │
                         └─────────────────────┘
```

## Architecture Patterns

| Pattern | Where Used |
|---|---|
| Clean Architecture + DDD | All Python microservices |
| CQRS | Steer & Skill services |
| Event-Driven | Domain events via RabbitMQ |
| API Gateway | Single entry point, auth, rate limiting |
| Feature-Sliced Design | React Native & Next.js apps |
| Repository Pattern | Data access abstraction |

## Service Ports

| Service | Port |
|---|---|
| API Gateway | 8000 |
| Steer Service | 8001 |
| Skill Service | 8002 |
| Auth Service | 8003 |
| AI Orchestrator | 8004 |
| Notification Service | 8005 |
| Web App | 3000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| RabbitMQ | 5672 / 15672 |
