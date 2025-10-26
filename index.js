import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './src/routes/authRoutes/authRoutes.js';
import connectDB from './src/config/db.js'; 

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

app.get('/', (req,res) => {
    res.send("Welcome to the DAW application!");
})

app.listen(PORT, () => {
    console.log(`server is running on PORT ${PORT}`);
})