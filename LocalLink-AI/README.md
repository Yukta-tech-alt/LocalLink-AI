# LocalLink AI — Hyperlocal Business Discovery Platform

LocalLink AI is a production-grade, full-stack hyperlocal business discovery and booking platform featuring role-based dashboards (Customer, Business Owner, Administrator) across 21 responsive pages, enhanced with 5 innovative, algorithmically verified features.

The application preserves a modern purple, lavender, and white visual design system with zero mockups and complete live backend connectivity.

---

## 🌟 The 5 Innovative Features

### 1. AI SmartMatch™
- **Purpose**: Intelligent conversational recommendation engine that evaluates customer natural language requirements rather than requiring exact keywords.
- **Algorithm**: Multi-factor weighted composite scoring:
  - **Specific Service Match** (35%): Direct match against specific service catalog items (e.g. *Ceiling fan installation & repair*, *Switchboard fix*).
  - **Category Alignment** (20%): Intelligent categorization across Home Services, Electronics, etc.
  - **Proximity & Distance Score** (15%): Real Haversine distance from customer coordinates.
  - **Budget Fit** (10%): Business starting price vs customer maximum budget constraint.
  - **Real-Time Availability** (10%): Verified active working hours and open status.
  - **Local Trust Score** (10%): 0–100 platform reliability indicator.
- **Transparent Rationale**: Every recommendation displays an exact match percentage (e.g., `91% Match`) and an explanation string specifying why the business was recommended.
- **Backend Endpoint**: `POST /api/smartmatch`

### 2. Local Trust Score™
- **Purpose**: A transparent 0–100 reliability indicator eliminating fake reviews and customer hesitation.
- **Transparent 5-Factor Formulation**:
  1. **Business Verification (20 pts)**: Official registration and moderator license check.
  2. **Customer Ratings & Reviews (25 pts)**: Weighted average rating and review volume.
  3. **Completed Jobs History (20 pts)**: Volume of successfully completed platform service requests.
  4. **Response & SLA Fulfillment (20 pts)**: Turnaround speed and request acceptance rate.
  5. **Dispute & Moderation Record (15 pts)**: Zero unresolved customer disputes or content reports.
- **UI Components**:
  - Interactive clickable badge (`Trust 88/100`) on all business cards, details, and comparison views.
  - Modal breakdown showcasing earned points, maximum weights, progress bars, and owner reputation improvement tips.
- **Backend Endpoint**: `GET /api/businesses/<id>/trust-score`

### 3. Multi-Business Quote Challenge™
- **Purpose**: Competitive bidding workflow connecting customers with verified local businesses.
- **Lifecycle**:
  1. **Post Challenge**: Customer submits requirements, budget, preferred time, and urgency. Challenge status is `Open`.
  2. **Submit Bids**: Eligible local businesses view the challenge and submit customized quotes (price, proposed time, estimated duration, included services, and message).
  3. **Side-by-Side Compare**: Customer reviews all received quotations side-by-side alongside each provider's Local Trust Score.
  4. **Atomic Acceptance**: Customer accepts one quote. Challenge status atomically transitions to `Assigned`, the winning bid becomes `Accepted`, other bids become `Declined`, and a linked `ServiceRequest` booking is automatically created.
  5. **Work Execution**: Business owner tracks the request through `Accepted` ➔ `In Progress` ➔ `Completed`.
- **Backend Endpoints**:
  - `POST /api/quotes/requests` — Customer creates challenge
  - `GET /api/quotes/requests` — List challenges with submissions
  - `POST /api/quotes/submissions` — Business owner submits quotation
  - `POST /api/quotes/requests/<id>/accept` — Customer accepts winning quotation
  - `PATCH /api/quotes/requests/<id>/cancel` — Customer cancels challenge

### 4. Regional Language Voice Search™
- **Purpose**: Inclusive speech-to-intent search supporting regional Indian languages.
- **Languages Supported**:
  - English (`en-IN`)
  - Kannada (`kn-IN` — ಕನ್ನಡ)
  - Hindi (`hi-IN` — हिन्दी)
- **Architecture**:
  - Frontend Web Speech API integration (`SpeechRecognition`) with pulsing microphone animation and user-friendly fallback.
  - Multilingual backend parser extracting service categories and intent from Kannada and Hindi phrases (e.g., `ವಿದ್ಯುತ್ ದುರಸ್ತಿ` ➔ Home Services, `बिजली का काम` ➔ Home Services).
- **Backend Endpoint**: `POST /api/voice-search/parse`

### 5. AI Business Growth Assistant™
- **Purpose**: Private AI advisor for business owners analyzing real platform transaction metrics.
- **Health Indicators**: Profile views, service inquiries, conversion rate %, unanswered requests, and average ratings.
- **Prioritized Recommendations**:
  - **High Priority**: Immediate issues impacting conversion (e.g. pending unanswered inquiries > 24h, zero pricing catalogs).
  - **Medium Priority**: SLA and customer satisfaction optimizations (e.g. replying to customer reviews, verification upgrades).
  - **Low Priority**: Profile enrichment and off-peak working hours tuning.
- **Actionable Evidence**: Every recommendation displays the exact data evidence, concrete action button, and projected business impact.
- **Backend Endpoint**: `GET /api/owner/growth-assistant`

---

## 🏗️ Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, Recharts
- **Backend**: Python 3.10+, Flask, Flask-SQLAlchemy, Flask-CORS, Werkzeug
- **Database**: SQLite (`backend/locallink.db`) by default; fully compatible with MySQL via `DATABASE_URL`
- **Security**: PBKDF2:SHA256 password hashing, Bearer token authentication, server-enforced role authorization (`customer`, `business`, `admin`)

---

## 👥 Demo Accounts

| Role | Email | Password | Pre-configured Data |
|---|---|---|---|
| **Customer** | `customer@locallink.ai` | `User@123` | Active bookings, favorites & reviews |
| **Business Owner** | `owner@locallink.ai` | `Owner@123` | Owns TechFix Solutions (Electronics) |
| **Administrator** | `admin@locallink.ai` | `Admin@123` | Full verification & moderation access |

---

## 🚀 Running the Project

### 1. Start Backend Server
Open Command Prompt in `backend`:

```bat
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
- Server starts on `http://127.0.0.1:5000`
- Database tables and seed data are initialized automatically.

### 2. Start Frontend Server
Open Command Prompt in `frontend`:

```bat
npm install
npm run dev
```
- Vite dev server starts on `http://localhost:5173`

### 3. Build for Production
```bat
cd frontend
npm run build
```
- Compiles 2,000+ modules into production assets in `frontend/dist/`.

---

## 🧪 Automated Testing Suites

Run all test suites from the `backend` directory:

```bat
# 1. Test All 5 Innovative Features
python test_innovative_features.py

# 2. Test All Backend API Endpoints & Auth
python test_api.py

# 3. Test Full 3-User Journeys & Cross-Dashboard Sync
python test_user_journeys.py
```

---

## 📑 21 Included Dashboard Pages

### Customer Dashboard (7 Pages)
1. **Customer Home**: Conversational discovery, AI SmartMatch hero, voice search, category navigation, saved favorites counter.
2. **Search Results**: Multi-facet filter (price, ratings, distance, verification) with voice search and AI SmartMatch toggle.
3. **Business Details**: Interactive tabs (Services, Customer Reviews, Working Hours), Local Trust Score breakdown modal, direct service booking, report modal.
4. **Map View**: Local spatial layout, business pins, category filters, quick drawer navigation.
5. **Compare & Choose**: Side-by-side comparison table including pricing, distance, availability, verified badges, and Local Trust Score.
6. **My Requests & Quote Challenges**: Tabbed view switching between direct service requests and Multi-Business Quote Challenges with side-by-side quote acceptance.
7. **Profile & Settings**: Customer details, saved locations, notification preferences, and bookmarked businesses.

### Business Owner Dashboard (7 Pages)
1. **Business Dashboard**: Real-time KPI stats, AI Business Growth Assistant, weekly activity charts, quick actions, and recent service requests.
2. **Manage Business**: Edit profile, category, contact info, working hours, and add/remove service catalog items with pricing.
3. **Service Requests & Quote Opportunities**: Tabbed interface to manage direct service requests (`Accepted` ➔ `In Progress` ➔ `Completed`) and bid on open customer Quote Challenges.
4. **Analytics**: Profile view velocity, conversion summary, and embedded AI Business Growth Assistant recommendations.
5. **Reviews & Reputation**: Customer feedback with owner reply capability.
6. **Availability & Hours**: Toggle store open/closed status and set daily opening/closing schedules.
7. **Business Settings**: Operating preferences and security settings.

### Administrator Dashboard (7 Pages)
1. **Admin Overview**: System-wide platform metrics (total users, active businesses, completed bookings, platform revenue).
2. **User Management**: View, filter, and manage registered customers and business owners.
3. **Business Verification**: Review pending business listings and approve or reject with automatic Trust Score updates.
4. **Reports & Insights**: Platform growth charts, category distribution, and fulfillment rates.
5. **Manage Categories**: Add, edit, and delete business categories with live platform synchronization.
6. **Reported Content**: Review flagged businesses and customer complaints with dismissal or action workflows.
7. **Platform Settings**: System configuration, moderation policies, and platform health toggles.
