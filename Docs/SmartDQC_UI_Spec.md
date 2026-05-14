# SmartDQC — UI Specification
### Internal Reference Document

---

## §1 — Overview and Design System

### Product
SmartDQC is a web-based data quality and clinical analytics platform for Malaysia's Ministry of Health (KKM). It ingests MyVASS and Klinik Kesihatan datasets, runs automated cleaning and quality scoring, and produces district-level nutrition reports.

### Palette — KKM Navy (canonical)
| Token            | Hex       | Usage                        |
|------------------|-----------|------------------------------|
| primary          | #1B2A4A   | Header, sidebar, primary CTAs |
| primary-dark     | #0F1B2F   | Hover states, active items    |
| primary-light    | #2E4A7A   | Secondary buttons, badges     |
| accent           | #C8962E   | Warning badges, highlights    |
| surface          | #F5F7FA   | Page background               |
| surface-card     | #FFFFFF   | Card backgrounds              |
| text-primary     | #1A1A2E   | Body copy                     |
| text-secondary   | #4A5568   | Labels, captions              |
| success          | #2D7D46   | Passing indicators            |
| danger           | #C0392B   | Failing indicators            |

> All four existing teal components (`ReportPage.tsx`, `ReportOptionsPanel.tsx`, `ReportPreviewPane.tsx`, `useReportGeneration.ts`) must be updated to use the navy palette before Day 6 UI is integrated.

### Typography
- Font: DM Sans (Google Fonts, existing in report components)
- Heading: DM Sans 600; Body: DM Sans 400; Monospace: JetBrains Mono (code/IC numbers)

### Routing
All pages live under a single React SPA. Auth-gated routes redirect to `/login` if no valid JWT is in `localStorage`.

| Path          | Component          | Auth Required |
|---------------|--------------------|---------------|
| /login        | LoginPage          | No            |
| /             | DashboardPage      | Yes           |
| /upload       | UploadPage         | Yes           |
| /explorer     | ExplorerPage       | Yes           |
| /quality      | QualityPage        | Yes           |
| /cleaning     | CleaningPage       | Yes           |
| /ai           | AIPage             | Yes           |
| /geo          | GeoPage            | Yes           |
| /reports      | ReportsPage        | Yes           |
| /chatbot      | ChatbotPage        | Yes           |
| /datasets     | DatasetLibraryPage | Yes           |
| /history      | HistoryPage        | Yes           |
| /settings     | SettingsPage       | Yes (admin)   |
| /audit        | AuditPage          | Yes (admin)   |

### Global Layout
- Top navbar: logo + nav links + user chip (username, role badge) + logout button
- Sidebar: collapsible, 64px icons collapsed / 220px expanded
- Content area: full-height scroll, 24px padding

### API Base URL
All API calls use `VITE_API_BASE_URL` env var (default `http://localhost:8000`). Set to remote GPU server URL in production.

### Auth
JWT stored in `localStorage` as `smartdqc_token`. Sent as `Authorization: Bearer <token>` header. Expiry: 8 hours. On 401 response: clear token and redirect to `/login`.

---

## §2 — Login Page (`/login`)

### Purpose
Authenticate user, obtain JWT, redirect to `/`.

### Layout
- Centered card (480px wide)
- Navy left panel: KKM logo + product name "SmartDQC"
- Right panel: username input, password input, "Masuk" button
- Error banner: danger red background if 401 returned

### API
`POST /auth/login` — form-encoded `username` + `password`

Response:
```json
{ "access_token": "ey...", "token_type": "bearer", "role": "admin" }
```

### Behaviour
1. On submit: POST to `/auth/login`
2. Store `access_token` in `localStorage["smartdqc_token"]`
3. On success: navigate to `/`
4. On 401: show "Nama pengguna atau kata laluan tidak sah" error banner
5. Default dev credentials: `admin` / `ADMIN_SEED_PASSWORD_PLACEHOLDER`

### Components
- `LoginCard` — centered form wrapper
- `useAuth` hook — wraps login/logout/me calls; exports `{ user, login, logout, isAuthenticated }`

---

## §3 — Dashboard Page (`/`)

### Purpose
System overview: recent sessions, quality trend, quick-action buttons.

### Layout
- Top row: 4 KPI cards (Active Sessions, Avg Quality Score, Total Rows Processed, Alerts)
- Middle row: Quality Score Trend sparkline (last 10 sessions) | Recent Sessions table
- Bottom row: Quick Actions — Upload New Dataset / View Reports / Open Chatbot

### APIs
- `GET /sessions` → `[{ cache_id, filename, source_type, row_count, quality_score }]`
- `GET /health` → `{ status: "ok" }` (green/red dot in header)

### Recent Sessions Table
| Column  | Source field  | Notes                                   |
|---------|---------------|-----------------------------------------|
| File    | filename      |                                         |
| Source  | source_type   |                                         |
| Rows    | row_count     |                                         |
| Quality | quality_score | Badge: ≥80 green, 60–79 amber, <60 red |
| Actions |               | View → /quality?cache_id=X              |

### Components
- `KpiCard` — icon, label, value, delta vs previous session
- `QualitySparkline` — recharts LineChart, navy stroke
- `SessionsTable` — sortable, row click navigates to /quality
- `QuickActions` — 3 navy CTA buttons

---

## §4 — Upload Page (`/upload`)

### Purpose
Ingest one or two CSV/Excel files, preview detected schema, confirm mapping, trigger cleaning.

### Layout
- Tab 1 "Fail Tunggal": drag-drop zone + source type radio (MyVASS / Klinik Kesihatan / Auto-detect)
- Tab 2 "Gabungkan (2 Fail)": two drop zones side by side
- Below: Schema Preview accordion (appears after upload completes)

### Schema Preview Table
| Your Column | Detected Standard Field | AI Confidence | Override |
|-------------|------------------------|---------------|----------|
| Nama        | name                   | 98%           | dropdown |
| Tarikh_L    | dob                    | 72%           | dropdown |

Override dropdown lists all 22 STANDARD_SCHEMA fields + "Abaikan" (Ignore).

### APIs
- `POST /upload/preview` — body: `{ file_b64, filename, source_type }`
  Response: `{ cache_id, rows, columns, sample, auto_mapping, ai_suggestions, unmapped_columns }`
- `POST /upload/merge-preview` — body: `{ file_a_b64, file_b_b64, filename_a, filename_b, source_type }`
  Response: same shape as above for merged frame

### Behaviour
1. File dropped → base64 encode client-side → POST /upload/preview
2. Response renders Schema Preview accordion
3. User reviews; can override any mapping via dropdown
4. "Lanjutkan ke Pembersihan" → POST /clean/run `{ cache_id, column_map }` → navigate to /cleaning

### Components
- `FileDropzone` — react-dropzone, accepts .csv .xlsx
- `SourceTypeSelector` — radio group
- `SchemaMappingTable` — table with dropdowns per row
- `MappingConfidenceBadge` — coloured % pill

---

## §5 — Explorer Page (`/explorer`)

### Purpose
Browse raw vs cleaned data side-by-side; inspect EDA statistics per column.

### APIs
- `POST /eda/run` → `{ cache_id, summary, issues, indicators }`
- `GET /eda/profile` → column-level stats (mean, std, null_count, unique_count)

### Layout
- Left panel: column selector list
- Main area: tabs — Raw Data | Cleaned Data | Profile Stats
- Raw/Cleaned tabs: paginated DataGrid (50 rows/page)
- Profile tab: one ColumnProfileCard per column

### Components
- `DataGrid` — virtual scroll, freeze first column
- `ColumnProfileCard` — histogram sparkline + stats table
- `IssueBadge` — red pill, issue count

---

## §6 — Quality Page (`/quality`)

### Purpose
Quality score breakdown — rule-by-rule pass/fail, issue heatmap, trend.

### APIs
- `GET /quality/score?cache_id=X` → `{ overall, by_rule: { rule_name: { score, count } } }`
- `GET /quality/issues?cache_id=X` → `[{ row_index, column, issue_type, value }]`
- `GET /quality/trend` → `[{ date, score }]` (last 30 sessions)

### Layout
- Top: Overall score gauge (0–100, navy arc)
- Left: Rule Breakdown list (rule name, progress bar, issue count)
- Right: Issue Table (filterable by issue_type)
- Bottom: Trend LineChart

### Components
- `ScoreGauge` — SVG arc, colour coded by tier
- `RuleBreakdownList` — progress bars per rule
- `IssueTable` — sortable, filterable
- `TrendLineChart` — recharts, navy stroke

---

## §7 — Cleaning Page (`/cleaning`)

### Purpose
Review automated cleaning operations; download cleaned output.

### APIs
- `POST /clean/run` — body: `{ cache_id, column_map }` → `{ rows_before, rows_after, actions_taken, quality_score }`
- `GET /clean/export?cache_id=X` — streams cleaned CSV

### Cleaning Action Types
| Code                | Label                              |
|---------------------|------------------------------------|
| missing_imputed     | Missing values imputed (median)    |
| duplicate_removed   | Duplicate rows removed             |
| outlier_flagged     | Outliers flagged (Z-score > 3)     |
| ic_corrected        | IC numbers normalised              |
| decimal_shift_fixed | Decimal shift corrected (×10)      |

### Layout
- Top: Before/After row count card + quality score delta badge
- Middle: Cleaning Actions accordion (grouped by action type)
- Bottom: "Muat Turun CSV" button + "Teruskan ke Laporan" button

### Components
- `CleaningSummaryCard` — before/after + delta
- `ActionAccordion` — collapsible per action type
- `DownloadButton` — GET /clean/export → triggers browser download

---

## §8 — AI Page (`/ai`)

### Purpose
Natural language query interface for exploratory analysis; returns answer + optional auto-generated chart.

### API
`POST /nlq/query` — body: `{ question: string, cache_id: string }`

Response:
```json
{
  "answer": "Kadar stunting di Petaling ialah 18.2%",
  "result": { "Petaling": 0.182 },
  "code": "df.groupby('district')['stunting'].mean()",
  "chart_b64": "<base64 PNG or null>"
}
```

### Layout
- Input bar fixed at bottom (full width, Enter to submit)
- Conversation thread above (scrollable)
- User bubble: right-aligned, navy background
- Assistant bubble: left-aligned, light grey
- If `chart_b64` present: inline PNG rendered below assistant bubble

### Example Queries
- "Berapa peratus kanak-kanak stunting di Daerah Petaling?"
- "Tunjukkan 5 daerah dengan kadar wasting tertinggi"
- "Adakah trend stunting bertambah baik dari 2022 ke 2024?"

### Components
- `ChatThread` — scrollable message list
- `MessageBubble` — user vs assistant styling variant
- `InlineChart` — renders `<img src={chart_b64}>` if present
- `QueryInput` — textarea + send button
