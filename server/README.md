# API Setup (MySQL + Docker)

## 1) Configure environment
1. Copy `../.env.example` to `server/.env`
2. Update MySQL credentials and `JWT_SECRET`

## 2) Start MySQL with Docker
From the project root:
```bash
docker compose up -d mysql
```

## 3) Install dependencies
```bash
npm install
```

## 4) Start API
```bash
npm run dev:api
```

## 5) Start frontend
```bash
npm run dev
```

Frontend calls API through Vite proxy at `/api`.

## Docker details
- Service: `mysql`
- Port: `3306`
- Database: `rbac_demo`
- User: `rbac_user`
- Password: `rbac_password`

## Seeded users
The API auto-creates users when the table is empty:
- Superadmin: from `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`
- Username: from `ADMIN_USERNAME`
- Password: from `ADMIN_PASSWORD`

## Endpoints
- `POST /api/auth/login`
- `GET /api/users` (admin, superadmin)
- `POST /api/users` (admin, superadmin; only superadmin can create superadmin)
- `PUT /api/users/:id/role` (admin, superadmin; only superadmin can assign/modify superadmin)
- `POST /api/forms` (authenticated)
- `GET /api/forms` (authenticated; users see own records, admin/superadmin see all)
