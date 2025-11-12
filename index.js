require('module-alias/register');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('@routes/authRoutes/authRoutes.js');
const connectDB = require('@config/db.js');
const marketPlaceRoutes = require('@routes/marketPlaceRoutes/marketplaceRoutes.js')
const extraMarketPlaceRoutes = require('@routes/marketPlaceRoutes/marketplaceExtraRoutes.js');
const AppError = require('@utils/Error/AppError.js');
import cooperativeRoutes from './src/routes/cooperativeRoutes/cooperativeRoutes.js';
import tierRoutes from './src/routes/tierRoutes/tierRoutes.js';
import memberRoutes from './src/routes/memberRoutes/memberRoutes.js';
import contributionRoutes from './src/routes/contributionRoutes/contributionRoutes.js';
import loanRoutes from './src/routes/loanRoutes/loanRoutes.js';
import connectDB from './src/config/db.js';
import { startCronJobs } from './src/jobs/monthlyContribution.cron.js'; 





dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const allowedOrigins =[
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
    methods: ['GET', 'PUT', 'POST', 'DELETE','PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'platform'],
    exposedHeaders: ['Authorization'],
    credentials: true,
}

app.use(cors(corsOptions));


app.use('/auth', authRoutes);

app.use('/marketplace', marketPlaceRoutes);
app.use('/marketplace', extraMarketPlaceRoutes);

app.get('/', (req,res) => {
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

app.listen(PORT, () => {
    console.log(`server is running on PORT ${PORT}`);
    startCronJobs();
    console.log("Cron jobs started");
})