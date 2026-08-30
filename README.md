# Kisan Procurement Mitra — SIH26032 Prototype

> **Smart India Hackathon (SIH26032)** — Farmer Procurement Assistance Platform  
> **Tagline:** *Simple • Transparent • Farmer First*

---

## 1. Project Overview & Philosophy

**Kisan Procurement Mitra** is a student-built prototype developed for **Smart India Hackathon Problem Statement SIH26032**. 

It provides an intuitive, accessible, and transparent digital interface for farmers to manage their agricultural procurement lifecycle:
- **Procurement Schedule:** Clarity on designated dates and time slots to prevent mandi congestion.
- **Digital Token:** Instant verification token (e.g., `TK-1042`) with printable gate pass.
- **Centre Status & Queue Insights:** Real-time visibility into queue depth and estimated waiting time.
- **Procurement & Payment Tracking:** Step-by-step verification from crop arrival to DBT bank payment settlement.
- **Bilingual Interface:** English + Hindi (हिंदी) language toggle for maximum farmer accessibility.
- **Mandi Officer / Admin Portal:** Dedicated dashboard to update weighing status, settle payments, and broadcast advisory notifications.

> ℹ️ **Prototype Disclaimer:** This prototype is presented as a farmer-centric interface layer designed to integrate with authorized government procurement systems (such as e-Uparjan, Food Corporation of India, and State Civil Supplies Corporations), subject to actual API/data availability.

---

## 2. Demo Credentials for Immediate Evaluation

| Role | Mobile Number | Password | Description |
| :--- | :--- | :--- | :--- |
| **Farmer (Default)** | `9876543210` | `123456` | Ramesh Patel (Sanwer, Indore • Wheat 18 Qtl) |
| **Admin / Mandi Officer** | `9999999999` | `admin123` | Mandi Officer (Admin Control Panel) |

*Note: You can also register a new farmer using the Registration page with 1-click sample data fill.*

---

## 3. Key Features & Workflows

### 🌾 1. Farmer Registration & Profile
- Fast registration with mobile number, village, district, state, crop type, land area, and preferred mandi centre.
- Automated Farmer ID generation (`FMR1001`) and instant token allocation.
- Profile view and live editing capability.

### 📅 2. Procurement Schedule & Token Slip
- Assigned date and time slots (e.g., `12 September 2026`, `10:00 AM – 11:00 AM`).
- Printable Digital Token slip formatted for gate pass verification.
- Filterable schedule history table.

### 🏛️ 3. Centre Status & Smart Visit Recommendation
- Real-time queue count (e.g., *18 farmers ahead*) and estimated waiting time (*~45 minutes*).
- Rule-based smart advisory guiding farmers to arrive during their allotted slot with necessary documents (Aadhaar, Bank Passbook, Land Revenue Khasra).

### 📈 4. 6-Stage Progress Tracker
1. **Registration** → 2. **Token Generated** → 3. **Scheduled** → 4. **Arrived** → 5. **Procurement Completed** → 6. **Payment Processed**

### 💰 5. Direct Benefit Transfer (DBT) Payment Tracking
- Expected amount calculation based on MSP rates (e.g., `₹45,000` for 18 Qtl Wheat).
- Status flags: `Pending` → `Processing` → `Paid`.
- Bank transaction reference IDs (`PAY-20260918-1001`).

### 👮‍♂️ 6. Mandi Officer / Admin Control Center
- High-level KPIs: Total Registered Farmers, Today's Schedule, Completed Procurements, Pending DBT Settlements.
- Searchable farmer directory with instant filtering.
- One-click procurement & payment status updater modal that updates the live database and sends alerts to farmers.
- Broadcast notification dispatch tool.

---

## 4. Tech Stack & Architecture

- **Backend:** Node.js, Express.js, JWT Authentication (`jsonwebtoken`), Password Hashing (`bcryptjs`).
- **Database Layer:** Dual-mode unified data layer supporting **MongoDB (Mongoose)** with automatic **In-Memory Fallback** for zero-configuration local evaluation.
- **Frontend:** Clean Semantic HTML5, Vanilla CSS3 (custom responsive variables, mobile-first flexbox/grid layout), Vanilla ES6+ JavaScript.
- **Localization:** Client-side dynamic English & Hindi translation dictionary.

---

## 5. API Endpoints Summary

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register new farmer & generate initial token
- `POST /api/auth/login` — Authenticate farmer or admin & return JWT

### Farmer Profile (`/api/farmers`)
- `GET /api/farmers/profile` — Get logged-in farmer details
- `PUT /api/farmers/profile` — Update farmer profile

### Procurement & Schedule (`/api/procurement`)
- `GET /api/procurement/my` — Get active token, schedule, progress, centre queue, and smart advice
- `GET /api/procurement/schedule` — Get list of procurement slots

### Centre Information (`/api/centres`)
- `GET /api/centres` — List all procurement centres with queue counts

### Notifications (`/api/notifications`)
- `GET /api/notifications` — Get farmer notifications
- `PUT /api/notifications/:id/read` — Mark notification as read
- `PUT /api/notifications/read-all` — Mark all notifications as read

### Admin Portal (`/api/admin`)
- `GET /api/admin/dashboard` — Get mandi aggregate stats & centre queue overviews
- `GET /api/admin/farmers` — List all farmers and procurement records
- `PUT /api/admin/procurement/:id` — Update weighing / payment status in database
- `POST /api/admin/notifications` — Broadcast notification to farmers

---

## 6. Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start application
npm start
# or
node backend/server.js

# 3. Open in browser
http://localhost:3000
```
