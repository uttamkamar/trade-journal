# Project: Personal Trading Journal

## Overview
A clean, lightweight personal web application for recording trades, daily profit/loss, trading mistakes, emotions, and lessons learned. This is a **digital diary for self-reflection**, not a trading terminal or analytics platform.

## Core Purpose
Help the trader answer:
- What trades did I take?
- Why did I take each trade?
- What mistakes did I make?
- Did I follow my trading plan?
- How much did I make or lose today?
- What is my overall profit or loss?
- Which mistakes do I keep repeating?

## Product Principles
1. Fast trade entry — adding a trade should take very little time
2. Journaling and self-review over advanced analytics
3. No clutter, unnecessary dashboards, or complex terminology
4. All P/L figures calculated consistently from saved trade records
5. Full CRUD — user can edit and delete their own records
6. Never silently discard, overwrite, or reset user data
7. Usable on desktop, tablet, and mobile
8. Clear labels and helpful empty states

## Stack Decision
- **Frontend:** React 18 + Vite 6 (TypeScript)
- **Styling:** Tailwind CSS v3 (CSS custom properties for light/dark themes)
- **Charts:** Recharts
- **State/Data:** React Query (TanStack) + Zustand (persisted theme state)
- **Database:** SQLite via Node.js built-in `node:sqlite` (Node.js backend)
- **Backend:** Express.js (minimal REST API)
- **Image storage:** Local filesystem (`uploads/`, served statically)
- **Export:** CSV (trades) + JSON (full backup)
- **Auth:** None (personal local app — single-user)
- **Persistence:** SQLite database file (`journal.db`), local to the machine

## Design System (UI UX Pro Max — Flat Design)
- **Style:** Flat Design, light-first with optional dark mode
- **Primary:** `#0D9488` (Teal 600)
- **Secondary:** `#14B8A6` (Teal 500)
- **Accent/CTA:** `#EA580C` (Orange 600)
- **Background:** `#F0FDFA` (Teal 50)
- **Foreground:** `#134E4A` (Teal 950)
- **Card:** `#FFFFFF`
- **Muted:** `#E8F1F4`
- **Typography:** Plus Jakarta Sans (headings + body)
- **Icons:** Phosphor Icons

## Source of Truth
Master prompt: `simple_personal_trading_journal_master_prompt_gsd_ponytail_uipro_v2.md`

## Project Directory
`<project-root>` (local repository root `./`)

## Created
2026-11-25
