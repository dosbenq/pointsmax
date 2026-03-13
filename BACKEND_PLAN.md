# PointsMax Backend Architecture Plan

This document outlines the high-level strategy for migrating from our current backend configuration (Next.js serverless functions + Supabase direct interactions) to a more robust, scalable, and maintainable backend architecture.

## Current Architecture Limitations

1. **Tight Coupling**: Database queries (`.from(...)`) and business logic are heavily intertwined with Next.js API routes.
2. **Cold Starts**: Vercel serverless functions incur cold start penalties, especially when instantiating new database connections.
3. **Complex State Management**: Operations like calculating optimal points or parsing complex reward logic are computationally heavy for serverless edge/lambda environments.
4. **Third-party Services**: AI (Gemini/Claude) and scrape jobs (via Inngest) are currently orchestrated by the Next.js app, which limits background processing flexibility.

## Proposed "Robust Backend" Architecture

Our goal is to build a dedicated backend service to handle core business logic, background processing, and database interactions, abstracting them away from the Next.js frontend.

### 1. Establish a Dedicated Backend Service

- **Technology Choice**: We will build a dedicated backend using Node.js/TypeScript (e.g., Express, NestJS, or a modern framework like Hono) to share type definitions with our frontend.
- **Responsibility**: This service will serve as the sole gateway to our Supabase database and external APIs (Seats.aero, AI providers, scraping targets).
- **Benefits**: Eliminates serverless cold starts for heavy operations, allows persistent connection pools to Postgres, and provides a stable environment for long-running calculations.

### 2. Isolate Business Logic

- Move the complex logic found in `/src/lib/calculate.ts` and card scoring algorithms to the new backend.
- The frontend will become a "dumb" client, strictly responsible for UI, sending user inputs, and rendering the results provided by the backend API.

### 3. Background Processing & Jobs

- Transition Inngest cron jobs (e.g., `youtube-learner`, `bonus-curator`, `update-valuations`) into a dedicated worker service or process within the new backend.
- Set up a message queue (e.g., Redis-based like BullMQ, or keep Inngest but route it through the new backend) to handle asynchronous tasks like syncing connected wallets or sending email drips reliably.

### 4. API Gateway & Microservices (Future)

- As the application grows, the monolithic backend can be split. For example, a dedicated service for the "AI Advisor" and another for "Award Search" integrations.
- Introduce an API Gateway (or rely on Next.js purely as a proxy) to route requests to the appropriate internal services.

## Next Steps for Implementation

1. **Setup Repository Structure**: Decide whether to use a monorepo (e.g., Turborepo) housing both the Next.js app and the new backend service, or split them into separate repositories.
2. **Define API Contracts**: Establish strict REST or GraphQL/tRPC contracts for the communication between the Next.js frontend and the new backend.
3. **Data Access Layer Migration**: Migrate the recently created `src/lib/db/` repositories into the new backend service.
4. **Gradual Rollout**:
   - Step 1: Create the backend service and route simple reads (e.g., `/api/cards`) through it.
   - Step 2: Move the heavy calculation logic (`/api/calculate`).
   - Step 3: Move AI and external integrations (`/api/award-search`, `/api/ai/recommend`).
   - Step 4: Fully deprecate direct Supabase access from the Next.js app.
