# TalentFlip Backend API

A comprehensive backend API for the TalentFlip.ai talent recruitment platform.

## Tech Stack

- **Node.js** (v22)
- **Express.js** - Web framework
- **PostgreSQL** - Database
- **Prisma** - Database ORM and query builder
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin resource sharing
- **OpenAI** - AI integration
- **Stripe** - Payment processing
- **Nodemon** - Development server
- **dotenv** - Environment variables

## Project Structure

```
backend/
├── config/
│   └── index.js              # Configuration and secrets
├── prisma/
│   └── schema.prisma         # Prisma database schema
├── src/
│   ├── app/
│   │   ├── helpers/
│   │   │   ├── responseHelper.js
│   │   │   └── validationHelper.js
│   │   └── modules/
│   │       ├── talent/
│   │       │   ├── talentRoutes.js
│   │       │   └── talentController.js
│   │       ├── recruiter/
│   │       │   ├── recruiterRoutes.js
│   │       │   └── recruiterController.js
│   │       └── admin/
│   │           ├── adminRoutes.js
│   │           └── adminController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── adminMiddleware.js
│   ├── app.js                # Express app configuration
│   └── routes.js             # Main routes
├── server.js                 # Server entry point
├── package.json
└── README.md
```

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory with the following variables:
   ```env
   PORT=3000
   NODE_ENV=development
   DATABASE_URL=postgresql://username:password@localhost:5432/talentflip?schema=public
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=7d
   JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
   JWT_REFRESH_EXPIRES_IN=30d
   OPENAI_API_KEY=your-openai-api-key-here
   OPENAI_MODEL=gpt-3.5-turbo
   STRIPE_SECRET_KEY=your-stripe-secret-key-here
   STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key-here
   STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret-here
   CORS_ORIGIN=http://localhost:3000
   CORS_CREDENTIALS=true
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   MAX_FILE_SIZE=10MB
   UPLOAD_PATH=uploads/
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   BCRYPT_ROUNDS=12
   SESSION_SECRET=your-super-secret-session-key-here
   ```

3. **Set up the database:**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database (for development)
   npm run db:push
   
   # Or create and run migrations (for production)
   npm run db:migrate
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Start the production server:**
   ```bash
   npm start
   ```

## Database Commands

- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database (development)
- `npm run db:migrate` - Create and run migrations (production)
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:seed` - Run database seeding script

## API Endpoints

### Health Check
- `GET /health` - API health status

### Talent Module
- `POST /api/talent/register` - Register new talent
- `POST /api/talent/login` - Talent login
- `GET /api/talent/profile` - Get talent profile
- `PUT /api/talent/profile` - Update talent profile
- `DELETE /api/talent/profile` - Delete talent profile
- `GET /api/talent/portfolio` - Get talent portfolio
- `POST /api/talent/portfolio` - Create portfolio item
- `PUT /api/talent/portfolio/:id` - Update portfolio item
- `DELETE /api/talent/portfolio/:id` - Delete portfolio item
- `GET /api/talent/applications` - Get talent applications
- `POST /api/talent/applications` - Create application
- `PUT /api/talent/applications/:id` - Update application
- `DELETE /api/talent/applications/:id` - Delete application
- `GET /api/talent/notifications` - Get notifications
- `PUT /api/talent/notifications/:id/read` - Mark notification as read
- `GET /api/talent/dashboard` - Get dashboard data

### Recruiter Module
- `POST /api/recruiter/register` - Register new recruiter
- `POST /api/recruiter/login` - Recruiter login
- `GET /api/recruiter/profile` - Get recruiter profile
- `PUT /api/recruiter/profile` - Update recruiter profile
- `DELETE /api/recruiter/profile` - Delete recruiter profile
- `GET /api/recruiter/jobs` - Get recruiter jobs
- `POST /api/recruiter/jobs` - Create job posting
- `PUT /api/recruiter/jobs/:id` - Update job posting
- `DELETE /api/recruiter/jobs/:id` - Delete job posting
- `GET /api/recruiter/applications` - Get job applications
- `PUT /api/recruiter/applications/:id/status` - Update application status
- `GET /api/recruiter/talents` - Search talents
- `GET /api/recruiter/talents/:id` - Get talent profile
- `GET /api/recruiter/notifications` - Get notifications
- `PUT /api/recruiter/notifications/:id/read` - Mark notification as read
- `GET /api/recruiter/dashboard` - Get dashboard data
- `POST /api/recruiter/create-payment-intent` - Create Stripe payment intent
- `POST /api/recruiter/webhook` - Handle Stripe webhooks

### Admin Module
- `GET /api/admin/users` - Get all users
- `GET /api/admin/talents` - Get all talents
- `GET /api/admin/recruiters` - Get all recruiters
- `GET /api/admin/jobs` - Get all jobs
- `GET /api/admin/applications` - Get all applications
- `PUT /api/admin/users/:id/status` - Update user status
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/analytics` - Get platform analytics
- `GET /api/admin/dashboard` - Get admin dashboard

## Development

The project uses a modular structure with separate modules for different user types (talent, recruiter, admin). Each module contains its own routes and controllers.

### Adding New Features

1. Create new routes in the appropriate module's routes file
2. Implement the corresponding controller methods
3. Add any necessary middleware
4. Update the main routes.js file if needed

### Database Models

Database models should be created in a `src/models/` directory (not yet created). Each model should correspond to a MongoDB collection.

## Security

- All sensitive configuration is stored in the `config/` directory
- The `config/` directory is included in `.gitignore` to prevent accidental commits
- JWT tokens are used for authentication
- Passwords are hashed using bcrypt
- CORS is configured for cross-origin requests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC
