## Docker Deployment

### Overview

This project uses Docker Compose to run the Brasaland monorepo services:

- **Public website:** port `3000`
- **Backoffice:** port `3001`
- **FastAPI backend:** port `8000`

The API and interfaces run in separate containers and communicate through the Docker Compose network.

### Prerequisites

- Docker
- Docker Compose v2
- A configured `.env.local` file containing the required environment variables

### Environment Configuration

Create `.env.local` in the repository root and configure the required variables based on `.env.example`.

Do not commit `.env.local`, passwords, API tokens, or other secrets to Git.

### Development

Start the development stack with hot reload:

```bash
docker compose up -d --build
```

Check the running containers:

```bash
docker compose ps
```

View service logs:

```bash
docker compose logs -f
```

Stop the development stack:

```bash
docker compose down
```

### Production Deployment

Build and start the production stack:

```bash
docker compose --env-file .env.local -f docker-compose.prod.yml up -d --build
```

Check production containers:

```bash
docker compose -f docker-compose.prod.yml ps
```

View production logs:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100
```

Stop the production stack:

```bash
docker compose -f docker-compose.prod.yml down
```

### Accessing the Application

- Public website: `http://YOUR_SERVER_IP:3000`
- Backoffice: `http://YOUR_SERVER_IP:3001`
- API: `http://YOUR_SERVER_IP:8000`

Replace `YOUR_SERVER_IP` with the public IP address of the server.

### Notes

The development configuration enables hot reload. The production configuration builds the Next.js application before starting it.

For a public production deployment, configure HTTPS, restrict direct access to internal services where appropriate, and ensure database security policies are correctly configured.
