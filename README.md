# AIVAS

AIVAS (Automated Inbound Verification & Analytics System) is a role-based web application for managing the inbound shipment lifecycle: purchase order creation, vendor shipment declaration, QR-based receiving, discrepancy handling, and inventory visibility.

The project is built with Next.js App Router and Supabase, with custom JWT authentication handled inside the app instead of Supabase Auth.

## What the app does

AIVAS supports the full procurement-to-receipt flow:

- PPIC creates and manages purchase orders.
- Vendors acknowledge POs, create delivery orders, and generate QR codes per box.
- Admin inbound scans arriving boxes, records actual quantity, and captures photo plus geolocation evidence.
- Supervisors review discrepancy tickets and inbound shipment outcomes.
- IT admins manage users, vendors, and supporting master data.

## User roles

The application currently exposes dedicated areas for these roles:

- `admin` -> inbound scanning and verification at `/admin`
- `ppic` -> purchase order and inventory management at `/ppic`
- `vendor` -> shipment and QR workflows at `/vendor`
- `supervisor` -> discrepancy and shipment monitoring at `/supervisor`
- `it` -> user and vendor administration at `/it`

Route access is enforced in `proxy.ts`.

## Tech stack

- Next.js App Router
- React 19
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Storage for inbound evidence
- JWT + `bcryptjs` for application-managed authentication
- `jsQR` for browser-side QR scanning
- `@react-pdf/renderer` for QR document generation

## Repository structure

```text
app/
  admin/                  inbound receiving UI
  it/                     IT admin UI
  login/                  login page
  ppic/                   purchase order and inventory UI
  supervisor/             discrepancy and shipment UI
  vendor/                 vendor shipment and QR UI
  api/                    Next.js route handlers
components/               layout shells and shared UI
lib/                      auth, QR, Supabase, and utilities
public/                   static images and icons
sql/
  schema.sql              database schema
  seeds.sql               sample seed data
docs/                     local architecture and project notes
```

## Main modules

### PPIC

- Manage purchase orders
- Manage inventory and item master data
- Manage vendor item sources
- Monitor shipment progress

### Vendor

- View assigned purchase orders
- Acknowledge or reject purchase orders
- Create delivery orders per shipment
- Generate and view QR codes for shipment boxes

### Admin inbound

- Scan QR codes using device camera
- Resolve shipment and item context
- Input actual received quantity
- Capture photo evidence and geolocation
- Complete receipt or hold/reject problematic items
- Review verification history

### Supervisor

- Review discrepancy tickets
- Monitor shipment status
- Follow inbound exceptions and recount/return flows

### IT admin

- Manage users
- Manage vendors

## Authentication and authorization

This project uses app-managed authentication:

- Credentials are checked against the `users` table.
- Passwords are verified with `bcryptjs`.
- The app signs a JWT using `JWT_SECRET`.
- The JWT is stored in an HttpOnly cookie.
- Role checks happen in both `proxy.ts` and server-side route handlers.

## API surface

The backend lives in `app/api/*`. Current route groups include:

- Auth: `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- Procurement: `/api/purchase-order`, `/api/purchase-order-item`
- Vendor shipment: `/api/delivery-order`, `/api/delivery-order-item`
- QR: `/api/qr-code`, `/api/qr-code/resolve`, `/api/qr-code/document`
- Receiving: `/api/inbound-scan`, `/api/inbound-scan/complete`, `/api/inbound-scan/sync`
- Evidence: `/api/photo_evidence`, `/api/geo-tag`, `/api/file`
- Master data: `/api/item`, `/api/item-source`, `/api/vendor`, `/api/user`, `/api/inventory-record`
- Monitoring: `/api/discrepancy-ticket`, `/api/audit-log`

## Database

The schema is defined in [`sql/schema.sql`](/c:/Users/dawud/Git/aivas/sql/schema.sql). Core tables include:

- `users`
- `vendor`
- `item`
- `item_vendor_source`
- `purchase_order`
- `purchase_order_item`
- `delivery_order`
- `delivery_order_item`
- `qr_code`
- `inbound_scan`
- `photo_evidence`
- `geo_tag`
- `discrepancy_ticket`
- `inventory_record`
- `audit_log`

Sample seed data is available in [`sql/seeds.sql`](/c:/Users/dawud/Git/aivas/sql/seeds.sql).

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
```

Notes:

- The server client currently uses `SUPABASE_SERVICE_ROLE_KEY` for database access.
- Keep service-role credentials server-only.
- `JWT_SECRET` should be set explicitly in every environment.