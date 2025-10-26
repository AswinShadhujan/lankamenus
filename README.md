# 🍽️ Lankamenus

**Lankamenus** is a modern restaurant discovery and listing platform powered by **NestJS**, **Prisma**, and **PostgreSQL**.
It’s built with scalability, clean architecture, and developer productivity in mind — fully containerized using **Docker**.

---

## 🚀 Features

* 🔍 Search restaurants by name, city, or cuisine
* 🧩 Modular NestJS architecture with TypeScript
* 🗄️ Database managed by Prisma ORM
* 🐳 Dockerized development environment
* 📦 Organized monorepo structure (`/services/api`, `/infra/docker`)

---

## 🛠️ Tech Stack

| Layer                    | Technology             |
| ------------------------ | ---------------------- |
| **Backend Framework**    | NestJS (TypeScript)    |
| **Database**             | PostgreSQL             |
| **ORM**                  | Prisma                 |
| **Package Manager**      | pnpm                   |
| **Infrastructure**       | Docker, Docker Compose |
| **Linting & Formatting** | ESLint, Prettier       |

---

## 🧩 Project Structure

```
lankamenus/
├── infra/
│   └── docker/
│       └── docker-compose.yml
├── services/
│   └── api/
│       ├── src/
│       │   ├── restaurants/
│       │   ├── prisma/
│       │   └── main.ts
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
└── README.md
```

---

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/AswinShadhujan/lankamenus.git
cd lankamenus
```

### 2. Start Docker containers

```bash
docker-compose up --build
```

### 3. Access the API

Once started, the backend will be available at:

```
http://localhost:3001
```

### 4. Test endpoints

Example:

```bash
curl "http://localhost:3001/restaurants?city=Colombo"
```

---

## 🧪 Example Response

```json
{
  "page": 1,
  "pagesize": 20,
  "total": 1,
  "data": [
    {
      "id": 1,
      "name_default": "Laksha Kitchen",
      "city": "Colombo",
      "district": "Colombo",
      "address_line1": "123 Galle Rd",
      "cuisine_tags": ["Sri Lankan"],
      "price_level": 1,
      "veg_friendly": true,
      "halal_certified": true,
      "created_at": "2025-10-10T17:17:59.644Z"
    }
  ]
}
```

---

## 🧾 Environment Variables

Create a `.env` file inside `/services/api`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lankamenus?schema=public"
PORT=3001
```

You can also include a `.env.example` for reference.

---

## 🧑‍💻 Development Commands

| Command                    | Description                 |
| -------------------------- | --------------------------- |
| `pnpm install`             | Install dependencies        |
| `pnpm run start:dev`       | Run API in development mode |
| `pnpm run prisma:generate` | Regenerate Prisma client    |
| `pnpm run prisma:studio`   | Open Prisma Studio          |

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

## 💬 Authors

**Pasan & Aswin**
📍 Based in Sri Lanka
🔗 [github.com/AswinShadhujan](https://github.com/AswinShadhujan)

---

> Built with ❤️ and TypeScript.
