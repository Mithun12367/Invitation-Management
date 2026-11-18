# HDU Cultural Festival – Architecture Document

## System Overview

A digital invitation management platform for the Bangladesh Cultural Festival at Hangzhou Dianzi University (HDU), Hangzhou, China.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND                              │
│              Hugging Face Spaces                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  React + TypeScript + Vite + Tailwind CSS           ││
│  │                                                     ││
│  │  PUBLIC ROUTES          ADMIN ROUTES                 ││
│  │  /                      /admin/login                 ││
│  │  /festival              /admin (dashboard)           ││
│  │  /invite/:token         /admin/teachers              ││
│  │                         /admin/invitations            ││
│  │                         /admin/qr-studio              ││
│  │                         /admin/card-editor            ││
│  │                         /admin/templates              ││
│  │                         /admin/rsvps                  ││
│  │                         /admin/event-settings         ││
│  │                         /admin/analytics              ││
│  └─────────────────────────────────────────────────────┘│
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS API Calls
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND                               │
│                   Supabase                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  PostgreSQL   │  │Edge Functions│  │   Storage     │ │
│  │  + RLS        │  │              │  │               │ │
│  │               │  │ /invitation  │  │ invitation-   │ │
│  │  profiles     │  │ /rsvp        │  │   artwork     │ │
│  │  teachers     │  │ /qr-validate │  │ event-posters │ │
│  │  events       │  │ /analytics   │  │ templates     │ │
│  │  invitations  │  │ /admin-ops   │  │ generated-    │ │
│  │  templates    │  │              │  │   cards       │ │
│  │  rsvps        │  │              │  │ qr-codes      │ │
│  │  public_      │  │              │  │ music-assets  │ │
│  │    settings   │  │              │  │               │ │
│  │  qr_scans     │  └──────────────┘  └───────────────┘ │
│  │  media_assets │                                       │
│  └──────────────┘  ┌──────────────┐                     │
│                    │    Auth       │                     │
│                    │  (Email/PWD)  │                     │
│                    └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## Database Entity Relationships

```
profiles (1) ──── manages ────> events (1..n)
events (1) ──────────────────> invitations (0..n) ◄──── teachers (1)
events (1) ──────────────────> rsvps (0..n)
invitations (1) ─────────────> rsvps (0..n)
invitations (1) ─────────────> qr_scans (0..n)
invitation_templates (1) ───> invitations (0..n)
events (1) ──────────────────> public_settings (1)
events (1) ──────────────────> media_assets (0..n)
```

## Security Architecture

1. **Authentication**: Supabase Auth with email/password for admins only
2. **Authorization**: Row Level Security (RLS) on all tables
3. **Token Security**: Crypto-random tokens for invitations, stored as SHA-256 hashes
4. **Edge Functions**: Server-side token validation, RSVP processing
5. **Service Role Key**: Only in Edge Functions (server-side), never in frontend
6. **Public Access**: Limited to invitation viewing and RSVP submission via Edge Functions

## China Compatibility Strategy

1. **Frontend**: Hosted on Hugging Face Spaces (accessible in China)
2. **Backend**: Supabase (needs verification for China access)
3. **Fonts**: Locally bundled (no Google Fonts)
4. **Assets**: All bundled in the app (no external CDN dependencies)
5. **No blocked services**: No Firebase, Google Analytics, etc.

## Key Technical Decisions

- **QR Generation**: Client-side using qrcode library, with server-side validation
- **Card Editor**: Fabric.js canvas-based editor
- **PDF Generation**: Client-side jsPDF for invitation cards
- **Analytics**: Privacy-conscious, server-side aggregation
- **Countdown**: Client-side with Day.js, Asia/Shanghai timezone
- **State Management**: React Context + hooks (no Redux needed)
