# Polygon Backend

A project about process geospatial workflow asynchronously.

## Running Locally

```bash
npm install
npm start
```

The server starts at `http://localhost:3000` 
The background worker begins polling for queued tasks immediately.

### Run tests

```bash
npm test
```
---

## Architecture Overview

```
POST /analysis
      │
      ▼
WorkflowFactory ──── reads example_workflow.yml
      │               creates Workflow + Tasks
      ▼
taskWorker
      │
      ├── checks task dependencies 
      ▼
TaskRunner
      │
      ├── sets task → in_progress
      ├── runs Job (PolygonAreaJob, DataAnalysisJob, ...)
      ├── saves task.output → completed / failed
      └── recalculateWorkflowStatus()
              └── sets workflow.finalResult when all tasks done
```

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
│   ├── Task.ts                  # Task entity (status, input, output, dependsOn — holds stepNumber of the dependency task)
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

## Collection

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

Obs: each task runs sequentially with a 5-second polling interval between steps.