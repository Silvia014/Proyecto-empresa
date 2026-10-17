
## Docker deployment

### Development
Run `docker compose up -d --build` for development with hot reload.

### Production
Run `docker compose --env-file .env.local -f docker-compose.prod.yml up -d --build` to build and start the production stack.

Configure the required environment variables in `.env.local` before starting. Never commit `.env.local` or secret keys.

The public website uses port 3000, the backoffice port 3001, and the FastAPI service port 8000.
