require('module-alias/register');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const expressWinston = require('express-winston');
const authRoutes = require('@routes/authRoutes/authRoutes.js');
const connectDB = require('@config/db.js');
const { seedDAWCooperative } = require('./src/scripts/seedDAWCooperative.js');
const marketPlaceRoutes = require('@routes/marketPlaceRoutes/marketplaceRoutes.js')
const extraMarketPlaceRoutes = require('@routes/marketPlaceRoutes/marketplaceExtraRoutes.js');
const AppError = require('@utils/Error/AppError.js');
const cooperativeRoutes = require("./src/routes/cooperativeRoutes/cooperativeRoutes.js");
const cooperativeDashboardRoutes = require("./src/routes/cooperativeRoutes/cooperativeDashboard.routes.js");
const tierRoutes = require('@routes/tierRoutes/tierRoutes.js');
const memberRoutes = require('@routes/memberRoutes/memberRoutes.js');
const contributionRoutes = require('@routes/contributionRoutes/contributionRoutes.js');
const loanRoutes = require('@routes/loanRoutes/loanRoutes.js');
const userRoutes = require('@routes/userRoutes/userRoutes.js');
const paymentRoute = require('@routes/paymentRoute/payment.route.js');
const kycRoutes = require('@routes/kycRoutes/kyc.js');
const { startCronJobs } = require('@jobs/monthlyContribution.cron.js');
const globalErrorHandler = require("./src/middlewares/errorMiddleware");
const { addPath } = require('module-alias');
const { vigipayWebhook } = require("@controllers/wallet/webhook/vigipayWebhook.controller.js");
const walletRoutes = require("@routes/wallet/wallet.routes.js");
const logger = require('@utils/logger/logger.js');
const dashboardRoutes = require('@routes/adminRoutes/dashboard.routes.js');
//webhook

dotenv.config();
connectDB();

const app = express();
app.use(expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}}",
  expressFormat: true,
  colorize: false,
}));

app.post('/api/v1/webhook/vigipay', express.raw({ type: 'application/json' }), vigipayWebhook);

const PORT = process.env.PORT || 3000;

app.use(express.json());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
]

const corsOptions = {
  origin: function (origin, callback) {
    console.log(" Incoming origin:", origin);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'platform'],
  exposedHeaders: ['Authorization'],
  credentials: true,
}

app.use(cors(corsOptions));


app.use('/auth', authRoutes);

app.use('/api/users', userRoutes);
app.use('/api/cooperatives', cooperativeRoutes);
app.use('/api/cooperatives', cooperativeDashboardRoutes);
app.use('/api/tiers', tierRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/loans', loanRoutes);

app.use('/marketplace', marketPlaceRoutes);
app.use('/marketplace', extraMarketPlaceRoutes);

app.use('/api', paymentRoute);
app.use('/kyc', kycRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', dashboardRoutes);

// Admin User Management Routes (consolidated)
const adminInvitationRoutes = require('@routes/adminRoutes/invitation.routes.js');
const adminUserRoutes = require('@routes/adminRoutes/user.routes.js');
// Mount invitation routes first (more specific paths like /invite)
app.use('/api/admin/users', adminInvitationRoutes);
// Then mount user CRUD routes (/:id patterns)
app.use('/api/admin/users', adminUserRoutes);

// Public Invitation Routes
const publicInvitationRoutes = require('@routes/invitationRoutes/invitation.routes.js');
app.use('/api/users/invite', publicInvitationRoutes);

app.get('/', (req, res) => {
  res.send("Welcome to the DAW application!");
})

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    status: err.status || 'error',
    message: err.message || 'Internal Server Error',
  });
});

app.use((req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
});

app.use(globalErrorHandler);

async function start() {
  await connectDB();
  await seedDAWCooperative();
  app.listen(PORT, () => {
    console.log(`server is running on PORT ${PORT}`);
    startCronJobs();
    console.log("Cron jobs started");
  });
}

start();