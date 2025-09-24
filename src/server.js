const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const path = require('path');
const multer = require('multer');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const stockRoutes = require('./routes/stock');
const cooperativeRoutes = require('./routes/cooperatives');
const storeRoutes = require('./routes/stores');
const paymentRoutes = require('./routes/payments');
const walletRoutes = require('./routes/wallet');
const loanRoutes = require('./routes/loans');
const contributionRoutes = require('./routes/contributions');
const reviewRoutes = require('./routes/reviews');
const favoritesRoutes = require('./routes/favorites');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const masterclassRoutes = require('./routes/masterclass');
const webhookRoutes = require('./routes/webhooks');
const paymentLinkRoutes = require('./routes/paymentLinks');
// const userUpgradeRoutes = require('./routes/user-upgrade');

// Load environment variables

const app = express();

// Middleware
app.use(cors({

  origin: "*", // Add both ports
  // credentials: true,
  // methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// MongoDB Connection URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/daw_backend';

// Connect to MongoDB with updated options
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  }
})
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if cannot connect to database
  });

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // upload folder
  },
  filename: (req, file, cb) => {
    // Preserve original extension
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, Date.now() + ext);
  }
});

const upload = multer({ storage: storage });


app.post("/api/upload", upload.single("file"), (req, res) => {
  // console.log(req.file);
  const usrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
  res.json({ message: 'File uploaded successfully', url: usrl })
})

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/cooperatives', cooperativeRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/masterclass', masterclassRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/payment-links', paymentLinkRoutes);
// app.use('/api/user-upgrade', userUpgradeRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Digital Agricultural Warehouse (DAW) API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 