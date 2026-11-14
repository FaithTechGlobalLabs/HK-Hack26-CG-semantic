# Cell Health API

A self-contained ASP.NET Minimal API for local cell-group check-ins, analysis, and semantic search. It uses LM-Kit.NET for local inference and stores check-ins in `backend/demo-data.json`; no external database or hosted model service is required.

## Run

Install the .NET 8 SDK or newer and Node.js 22+, then start the API:

```sh
dotnet run --project backend/CellHealthApi.csproj
```

On an interactive terminal, the backend loads `nomic-embed-text` and uses it to rank chat-model descriptions against what you type (for example, “a small, fast model for warm pastoral conversations”). The match score measures similarity to your description, not model quality. Results show whether a model is already downloaded, its catalog file size, and a rough fit estimate based on this computer's memory budget. Choose a result to download it if needed. The estimate is not a guarantee: actual memory use also depends on runtime settings, context length, and other apps.

Choices come from the chat-capable models in the installed LM-Kit.NET predefined catalog, not from a live search across every model published online. Updating LM-Kit.NET can update the catalog. The default is `qwen3.5:4b` when it is present; otherwise the first catalog model is used. The selected chat model and `nomic-embed-text` are downloaded automatically if they are not already cached; allow several gigabytes of free disk space. To select a model without the prompt, set `CELL_HEALTH_CHAT_MODEL` to a chat-capable catalog ID, or pass `--ChatModelId <model-id>` to the app. For example:

```sh
CELL_HEALTH_CHAT_MODEL=qwen3.5:9b dotnet run --project backend/CellHealthApi.csproj
dotnet run --project backend/CellHealthApi.csproj -- --ChatModelId llama-3.2-3b
```

In non-interactive sessions, the API uses `qwen3.5:4b` unless a model is configured. The embedding model remains `nomic-embed-text`. The API allows browser requests from `http://localhost:3000`.

In another terminal, start the web app:

```sh
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend connects to `http://localhost:5000` by default; set `NEXT_PUBLIC_CELL_HEALTH_API_URL` to change the API origin. If the local model API is still loading or unavailable, the frontend switches to clearly labeled simulated demo data and reconnects automatically.

If port 5000 is already in use, start the API on another port and point the frontend to it:

```sh
dotnet run --project backend/CellHealthApi.csproj --urls http://localhost:5001
cd frontend
NEXT_PUBLIC_CELL_HEALTH_API_URL=http://127.0.0.1:5001 npm run dev
```

When connected, the local chat model asks role-specific follow-up questions. After three responses, the local model classifies the participant's answers and writes an anonymized summary; the embedding model indexes that summary for semantic search. The simulated fallback uses simple keyword matching and is not semantic analysis.

## Endpoints

- `GET /api/dashboard?role=member|leader|staff&groupId=G001`
- `POST /api/chat` with `{ "role": "member", "message": "...", "history": [] }`
- `POST /api/analyze` with `{ "groupId": "G001", "role": "member", "participantResponses": ["..."], "synthesizedSummary": "...", "transcript": "..." }`
- `POST /api/search` with `{ "query": "..." }`

The demo has no authentication or user identity layer. Member dashboard responses expose only group check-in status; leader requests are scoped to one requested group and expose domain aggregates only after at least three check-ins. Staff dashboards expose metrics for all 108 groups, with seed summaries and burnout alerts for groups that have data.

New analyzed check-ins are appended to `backend/demo-data.json`. Embeddings are kept in memory and rebuilt from saved summaries on startup.
