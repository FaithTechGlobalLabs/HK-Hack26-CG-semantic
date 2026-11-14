# Cell Health API

A self-contained ASP.NET Minimal API for local cell-group check-ins, analysis, and semantic search. It uses LM-Kit.NET for local inference and stores check-ins in `backend/demo-data.json`; no external database or hosted model service is required.

## Run

Install the .NET 8 SDK or newer and Node.js 22+, then start the API:

```sh
dotnet run --project backend/CellHealthApi.csproj
```

The first launch downloads `qwen3.5:4b` and `nomic-embed-text` through LM-Kit's model catalog. Allow several gigabytes of free disk space. The API allows browser requests from `http://localhost:3000`.

In another terminal, start the web app:

```sh
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend connects to `http://localhost:5000` by default; set `NEXT_PUBLIC_CELL_HEALTH_API_URL` to change the API origin. If the local model API is still loading or unavailable, the frontend switches to clearly labeled simulated demo data and reconnects automatically.

## Endpoints

- `GET /api/dashboard?role=member|leader|staff&groupId=G001`
- `POST /api/chat` with `{ "role": "member", "message": "...", "history": [] }`
- `POST /api/analyze` with `{ "groupId": "G001", "role": "member", "synthesizedSummary": "...", "transcript": "..." }`
- `POST /api/search` with `{ "query": "..." }`

The demo has no authentication or user identity layer. Member dashboard responses expose only group check-in status; leader requests are scoped to one requested group and expose domain aggregates only after at least three check-ins. Staff dashboards expose metrics for all 108 groups, with seed summaries and burnout alerts for groups that have data.

New analyzed check-ins are appended to `backend/demo-data.json`. Embeddings are kept in memory and rebuilt from saved summaries on startup.
