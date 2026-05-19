# Crime Insight Hub

An interactive crime data analysis dashboard. Upload any crime dataset (CSV) and instantly get hotspot clusters, anomaly detection, arrest-rate breakdowns, and trend visualizations driven entirely by your uploaded data.

## Features

- 🔐 Email/password authentication
- 📤 Upload any crime-related CSV — the dashboard adapts to your dataset
- 📊 Live KPIs: total incidents, arrest rate, anomalies detected, hotspot clusters
- 🗺️ Hotspot cluster detection from location data
- 🚨 Statistical anomaly detection on incident counts
- 📈 Crime-type and time-trend visualizations
- ☁️ Backed by Lovable Cloud (Postgres + Auth + RLS)

## Tech Stack

- **Framework:** TanStack Start v1 (React 19, Vite 7, SSR-ready)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Backend:** Lovable Cloud (Supabase Postgres, Auth, RLS)
- **Charts:** Recharts
- **Language:** TypeScript

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (or Node 20+ with npm)
- A Lovable Cloud / Supabase project (publishable URL + anon key)

### Install

```bash
bun install
```

### Configure environment

Create a `.env` file at the project root:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

These are public/publishable keys — safe to share with reviewers.

### Run

```bash
bun run dev
```

Open the URL printed in the terminal (usually http://localhost:5173).

## Using the App

1. **Sign up** with email and password.
2. Go to the **Upload** page and select a crime-related CSV.
3. Open the **Dashboard** — all metrics, charts, hotspots, and anomalies are computed from the dataset you uploaded.
4. Upload a different CSV anytime to see the dashboard refresh against the new data.

### Expected CSV format

The parser is flexible and will auto-detect common column names. For best results include some of:

- A date/time column (e.g. `date`, `occurred_on`, `timestamp`)
- A crime type / category column (e.g. `crime_type`, `offense`, `category`)
- A location column (e.g. `location`, `district`, `area`) and optionally `latitude` / `longitude`
- An arrest indicator (e.g. `arrest`, `arrested` — true/false or yes/no)

Extra columns are ignored. Sample datasets: [Chicago Crimes](https://data.cityofchicago.org/Public-Safety/Crimes-2001-to-Present/ijzp-q8t2), [LA Crime Data](https://catalog.data.gov/dataset/crime-data-from-2020-to-present).

## Screenshots

_Add screenshots here once you've deployed or captured them._

- `docs/screenshot-dashboard.png` — Dashboard view
- `docs/screenshot-upload.png` — Upload flow

## Project Structure

```
src/
├── routes/              # File-based routes (TanStack Router)
│   └── _authenticated/  # Protected routes (dashboard, upload)
├── components/          # Reusable UI components
├── hooks/               # React hooks (use-crimes, etc.)
├── lib/                 # CSV parsing, analytics helpers
└── integrations/
    └── supabase/        # Auto-generated Supabase client
supabase/
└── migrations/          # Database schema
```

## Built With

Made with [Lovable](https://lovable.dev) — the AI editor for full-stack web apps.
