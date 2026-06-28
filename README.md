# Polygon Backend

A Node.js/TypeScript backend that processes geospatial workflows asynchronously. Workflows are defined in YAML, tasks run sequentially with dependency support, and results are aggregated when all steps complete.

## Architecture Overview

```
POST /analysis
      │
      ▼
WorkflowFactory ──── reads example_workflow.yml
      │               creates Workflow + Tasks (queued)
      ▼
taskWorker (polls every 5s)
      │
      ├── checks task dependencies (dependsOn)
      ▼
TaskRunner
      │
      ├── sets task → in_progress
      ├── runs Job (PolygonAreaJob, DataAnalysisJob, etc.)
      ├── saves task.output → completed / failed
      └── recalculateWorkflowStatus()
              └── sets workflow.finalResult when all tasks done
```

## Workflow Steps

The default workflow (`src/workflows/example_workflow.yml`) runs 4 sequential steps:

| Step | taskType            | Depends On | Description                                      |
|------|---------------------|------------|--------------------------------------------------|
| 1    | `polygonArea`       | —          | Calculates polygon area in m² from GeoJSON       |
| 2    | `analysis`          | step 1     | Detects which country the polygon is located in  |
| 3    | `notification`      | step 2     | Sends an email notification (simulated, 500ms)   |
| 4    | `reportGeneration`  | step 3     | Aggregates outputs from all preceding steps      |

## Project Structure

```
src/
├── data/
│   └── world_data.json          # Country geometry data for analysis
├── jobs/
│   ├── Job.ts                   # Job interface
│   ├── JobFactory.ts            # Maps taskType → Job class
│   ├── PolygonAreaJob.ts        # Calculates polygon area via @turf/area
│   ├── DataAnalysisJob.ts       # Country detection via @turf/boolean-within
│   ├── EmailNotificationJob.ts  # Simulated email notification
│   └── ReportGenerationJob.ts  # Aggregates preceding task outputs
├── models/
│   ├── Task.ts                  # Task entity (status, input, output, dependsOn…)
│   └── Workflow.ts              # Workflow entity (status, finalResult)
├── routes/
│   ├── analysisRoutes.ts        # POST /analysis
│   └── workflowResults.ts       # GET /workflow/:id/status and /results
├── tests/
│   ├── PolygonAreaJob.test.ts
│   └── ReportGenerationJob.test.ts
├── workers/
│   ├── taskRunner.ts            # Executes jobs, manages state transitions
│   └── taskWorker.ts            # Background polling loop
├── workflows/
│   ├── WorkflowFactory.ts       # Creates workflows from YAML
│   └── example_workflow.yml     # Default workflow definition
├── data-source.ts               # TypeORM + SQLite configuration
└── index.ts                     # Express server entry point
```

## Task & Workflow States

**Task status lifecycle:**
```
queued → in_progress → completed
                    └→ failed
```

**Workflow status lifecycle:**
```
initial → in_progress → completed
                     └→ failed
```

A workflow reaches `completed` only when all tasks complete. If any task fails, the workflow becomes `failed` and downstream tasks remain queued (never picked up).

## API Endpoints

### `POST /analysis`

Creates a new workflow and queues all tasks for processing.

**Request:**
```json
{
  "clientId": "client123",
  "geoJson": {
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[
        [-63.624885, -10.311050],
        [-63.624885, -10.367865],
        [-63.612783, -10.367865],
        [-63.612783, -10.311050],
        [-63.624885, -10.311050]
      ]]
    }
  }
}
```

**Response `201`:**
```json
{
  "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
  "message": "Workflow created and tasks queued from YAML definition."
}
```

---

### `GET /workflow/:id/status`

Returns the current progress of a workflow.

**Response `200`:**
```json
{
  "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
  "status": "in_progress",
  "completedTasks": 2,
  "totalTasks": 4
}
```

Returns `404` if the workflow ID does not exist.

---

### `GET /workflow/:id/results`

Returns the aggregated results once the workflow is completed.

**Response `200`:**
```json
{
  "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
  "status": "completed",
  "finalResult": {
    "workflowId": "3433c76d-f226-4c91-afb5-7dfc7accab24",
    "tasks": [
      { "taskType": "polygonArea",        "status": "completed", "output": { "area": 8363367, "unit": "m^2" } },
      { "taskType": "analysis",           "status": "completed", "output": "Brazil" },
      { "taskType": "notification",       "status": "completed", "output": {} },
      { "taskType": "reportGeneration",   "status": "completed", "output": { "workflowId": "...", "tasks": [...], "finalReport": "3 of 3 preceding task(s) completed successfully" } }
    ]
  }
}
```

Returns `404` if workflow not found, `400` if not yet completed.

---

## Running Locally

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Start the server

```bash
npm start
```

The server starts at `http://localhost:3000`. The background worker begins polling for queued tasks immediately.

> **Note:** The database uses `dropSchema: true`, so all data is wiped on every server restart. Re-create workflows after restarting.

### Development (auto-reload)

```bash
npm run dev
```

### Run tests

```bash
npm test
```

---

## Example: Full Workflow Run

```bash
# 1. Create workflow
curl -X POST http://localhost:3000/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client123",
    "geoJson": {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-63.624885, -10.311050],
          [-63.624885, -10.367865],
          [-63.612783, -10.367865],
          [-63.612783, -10.311050],
          [-63.624885, -10.311050]
        ]]
      }
    }
  }'

# 2. Poll status (replace with your workflowId)
curl http://localhost:3000/workflow/<workflowId>/status

# 3. Fetch results once status is "completed"
curl http://localhost:3000/workflow/<workflowId>/results
```

Each task runs sequentially with a 5-second polling interval between steps, so the full workflow takes ~20–25 seconds to complete.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **ORM:** TypeORM with SQLite
- **Geospatial:** @turf/area, @turf/boolean-within
- **Workflow definition:** YAML (js-yaml)
- **Testing:** Jest + ts-jest
