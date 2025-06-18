## Default Admin User

On first run, the application will automatically create a default admin user:

- **Username:** `admin`
- **Password:** `AdminSetup455`
- **Email:** `admin@towertrack.local`

## Docker Setup

```bash
# Build and run with Docker
docker compose up --build

# Dev environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# The admin user will be created automatically on first startup
```

The application will be available at http://localhost:3000

Log in with the default credentials and navigate to the user management section to change the password.
