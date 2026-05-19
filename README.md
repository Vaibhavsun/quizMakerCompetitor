# Quiz Competition Maker

A 1v1 real-time quiz game. One player creates a room, an AI agent generates 10 multiple-choice questions on the requested topic, and a second player joins via the room ID. Both race to answer each question before the 10-second timer runs out. Higher score wins.

The repo has two runnable apps:

- **`backend/`** — Node + Express REST API (auth, room CRUD, AI quiz generation) and a Socket.io server (real-time gameplay).
- **`client/`** — React + Vite + Tailwind frontend.

---

## Architecture at a glance

```
                ┌──────────────────────┐
                │   client (Vite)      │
                │   http://:5173       │
                └─────────┬────────────┘
                          │
            REST (4000)   │   WebSocket (5000)
                          │
┌──────────────────────────────────────────────┐
│                 backend                       │
│ ┌──────────────┐   ┌──────────────────────┐   │
│ │ express.js   │   │ socket.io server     │   │
│ │ /user, /room │   │ join-room, send-     │   │
│ │              │   │ question, submit-    │   │
│ │              │   │ answer, game-ended   │   │
│ └──────┬───────┘   └─────────┬────────────┘   │
│        │                     │                │
│        └──────► Prisma ──────┘                │
│                   │                           │
│              PostgreSQL                       │
│                                               │
│        OpenAI-compatible Bedrock endpoint     │
│        (gpt-oss-20b) → 10-question quiz JSON  │
└──────────────────────────────────────────────┘
```

### Data model (Prisma)

- **User** — `id` (cuid), `email` (unique), `password` (scrypt `salt:hash`).
- **room** — `id`, `hostId`, `topic`, `quizdata` (JSON array of `{question, options[4], answer}`), `quiz_index` (current question pointer).
- **RoomPlayer** — `(roomId, userId)` unique pair, `score`, `state` (`WAITING | PLAYING | COMPLETED`).

### Quiz generation

`POST /room/create` does two things:

1. Calls `quizService.generateQuiz` with `{ difficulty, description }`. The service hits an OpenAI-compatible endpoint on AWS Bedrock and asks for exactly 10 MCQs as a strict JSON array. The output is validated with Zod (`quizOutSchema`).
2. Creates a `room` row with the quiz payload baked into `quizdata` and adds the host as the first `RoomPlayer`.

### Real-time game lifecycle

```
client A         server                       client B
   │  connect (?userId=…&roomId=…)              │
   │ ─────────►                                 │
   │  join-room(roomId)                         │
   │ ─────────► (1 of 2)                        │
   │                                            │
   │                       connect + join-room ◄┤
   │                       (2 of 2 → start)     │
   │ ◄──────── start-game { questions } ───────►│
   │                                            │
   │  submit-answer { roomId, qIdx, choice }    │
   │ ─────────► (callback: {correct, score})    │
   │                                            │
   │     [10s timer fires on the room]          │
   │ ◄──────── send-question { question, … } ──►│
   │                                            │
   │     (repeat for 10 questions)              │
   │ ◄──────── game-ended { score, … } ────────►│

  If a player disconnects mid-game:
   │ ◄──────── opponent-left { reconnectWindowMs } 60s
   │
   │ If they return inside the window:          │
   │ ◄──────── game-resumed { remainingMs, question }
   │                                            │
   │ If they don't:                             │
   │ ◄──────── game-ended { reason: "opponent-timeout", winnerUserId }
```

---

## Backend

### Tech

- Node 18+, ES modules.
- `express@5`, `socket.io@4`, `zod` for validation, `@prisma/client` for DB, `openai` for AI calls, `dotenv` for env.
- Passwords hashed with Node's built-in `crypto.scrypt` (no bcrypt dependency) — stored as `salt:hash`.

### REST endpoints

| Method | Path             | Body / params                              | Returns                                            |
| ------ | ---------------- | ------------------------------------------ | -------------------------------------------------- |
| GET    | `/health`        | —                                          | Healthcheck HTML                                   |
| POST   | `/user/register` | `{ email, password }`                      | `{ message, user }` (user has no password field)   |
| POST   | `/user/login`    | `{ email, password }`                      | `{ message, user }`                                |
| GET    | `/user/me/:id`   | —                                          | The user (without password) or 404                 |
| POST   | `/room/create`   | `{ userId, topic, difficulty, description }` | `{ message, data: { url, quiz, … } }` — `url` is `/room/<id>` |
| GET    | `/room/:id`      | —                                          | Room object                                        |
| GET    | `/room`          | —                                          | All rooms                                          |
| PUT    | `/room/:id`      | partial RoomPlayer fields                  | Updated player row                                 |
| DELETE | `/room/:id`     | —                                          | `{ message }`                                      |

### Socket events

Connect with `io(SOCKET_URL, { query: { userId, roomId } })` — both query params are required by the connection middleware (`socket_validation.js`, `sockets.room.validation.js`).

**Client → server**

| Event           | Payload                                              | Callback                                                                       |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `join-room`     | `roomId` (string)                                    | `{ success: true }` / `{ success: true, resumed: true }` / `{ error }`         |
| `submit-answer` | `{ roomId, questionIndex, chosenOption }` (option 0–3) | `{ success: true, data: { correct, questionIndex, score } }` / `{ error }`   |
| `room-update`   | partial RoomPlayer fields                            | `{ success, data }` / `{ error }`                                              |

**Server → client (broadcast to room)**

| Event           | Payload                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| `start-game`    | `{ message, roomId, questions: { questionIndex, question: {…}, totalQuestions } }`   |
| `send-question` | `{ question: { questionIndex, question: {…}, totalQuestions }, timeLimit }`           |
| `opponent-left` | `{ message, reconnectWindowMs }`                                                     |
| `game-resumed`  | `{ remainingMs, question }`                                                          |
| `game-ended`    | `{ score }` (last-question case) or `{ reason: "opponent-timeout", winnerUserId, … }` |

### Environment (`backend/.env`)

```
DATABASE_URL=postgresql://user:pass@localhost:5432/quizmaker
PORT=4000
SOCKET_PORT=5000
OPENAI_API_KEY=…           # used as a Bedrock bearer token
QUESTION_DURATION_MS=10000 # optional, default 10s
RECONNECT_WINDOW_MS=60000  # optional, default 60s
```

### Running

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev   # first time only
npm run dev              # nodemon on server.js
```

REST listens on `:4000`, socket.io on `:5000` (separate ports — the client wires them up independently).

---

## Frontend (`client/`)

### Tech

- React 19 + Vite 7, Tailwind v4, react-router v7, react-hook-form, socket.io-client.

### Pages

| Route                     | What it does                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `/auth`                   | Login / Sign Up. Stores the returned `user` in `localStorage` under `qcm.user`.                                          |
| `/`                       | Home hub — links to Create or Join a room. Shows the signed-in user's email and ID.                                      |
| `/rooms/new`              | Form: topic, difficulty, description → `POST /room/create` → redirects into the game page with the new `roomId`.        |
| `/rooms/join`             | Paste a room ID, verifies it exists via `GET /room/:id`, then enters the game page.                                      |
| `/rooms/:roomId/play`     | Live game. Connects the socket, emits `join-room`, renders questions, submits answers, handles pauses/reconnects.        |
| `/rooms/:roomId/results`  | Final score / winner. Reached by `game-ended`.                                                                          |

Routes other than `/auth` are wrapped in `<RequireAuth>` — no user in `localStorage` → redirect to `/auth`.

### Source layout

```
client/src/
├── App.jsx                  routes + auth guard
├── main.jsx
├── index.css
├── lib/
│   ├── api.js               fetch wrapper for the REST API
│   ├── socket.js            singleton socket.io-client connector
│   └── auth.js              localStorage user helpers
├── components/
│   └── cards/AuthCard.jsx   login/signup form (controlled, react-hook-form)
└── pages/
    ├── Auth/AuthPage.jsx
    ├── Home/HomePage.jsx
    ├── Room/CreateRoomPage.jsx
    ├── Room/JoinRoomPage.jsx
    ├── Game/GamePage.jsx    ◄── all socket lifecycle lives here
    └── Results/ResultsPage.jsx
```

### Environment (`client/.env`)

Copy `.env.example` → `.env` and edit if your backend runs elsewhere:

```
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:5000
```

### Running

```bash
cd client
npm install
npm run dev    # http://localhost:5173
```

---

## Full local run-through

In three terminals:

```bash
# 1. Postgres (or use docker / a managed db)
#    Make sure DATABASE_URL in backend/.env points to it.

# 2. Backend
cd backend && npm install && npx prisma migrate dev && npm run dev

# 3. Frontend
cd client && npm install && cp .env.example .env && npm run dev
```

Open two browsers (or one regular + one incognito):

1. Both sign up with different emails at `http://localhost:5173/auth`.
2. In window A: **Create a room** → fill topic/difficulty/description → wait for the AI to generate the quiz → you'll land in the play page with "Waiting for an opponent…" and the room ID is shown there.
3. Copy the room ID into window B at **Join a room**.
4. As soon as B joins, the game starts in both windows. Tap an answer, watch the timer, race to the highest score over 10 questions.

---

## Things that are intentionally minimal

These are gaps in the current backend that the frontend works around (or doesn't), rather than bugs introduced by the frontend:

- No JWT / session — the client just persists the `user` object returned from `/user/login` in `localStorage` and passes `userId` to the socket as a query param. The socket connection middleware verifies the user exists in the DB, but anything in the client could spoof a different `userId`.
- The `start-game` and `send-question` payloads include the question's `answer` field. The frontend uses it only to colour the correct option green *after* the player submits. Don't expose this UI to untrusted players.
- The game is hard-capped at 2 players (`io.sockets.adapter.rooms.get(roomId)?.size === 2` triggers start). The lobby/waiting UI reflects that.
- No persistence of past games on the home page — `GET /room` returns everything but the UI doesn't list it. Easy to add later.
