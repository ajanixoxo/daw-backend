# Digital African Women Platform - Backend

This is the backend server for the Digital African Women platform, a digital commerce platform that supports African women entrepreneurs.

## Features

- User Authentication & Authorization
- Product Marketplace
- Shopping Cart
- Order Management
- Role-based Access Control

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- Cloudinary (Image Upload)
- Express Validator
- Various security middlewares

## Project Structure

```
backend/
├── src/
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   ├── controllers/     # Route controllers
│   ├── utils/          # Helper functions
│   └── server.js       # Main application file
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- POST /api/auth/signup - Register new user
- POST /api/auth/login - User login

### Users
- GET /api/users/:id - Get user profile
- PUT /api/users/:id - Update user profile
- DELETE /api/users/:id - Delete user

### Products
- POST /api/products - Add product
- GET /api/products - Get all products
- GET /api/products/:id - Get specific product
- PUT /api/products/:id - Update product
- DELETE /api/products/:id - Delete product

### Cart
- POST /api/cart/add - Add to cart
- GET /api/cart/:userId - Get user's cart
- PUT /api/cart/:userId - Update cart
- DELETE /api/cart/:userId/:productId - Remove from cart

### Orders
- POST /api/orders - Create order
- GET /api/orders - Get all orders

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file with required variables
4. Run the development server:
   ```bash
   npm run dev
   ```

## Security Features

- JWT Authentication
- Password Hashing
- Role-based Authorization
- Request Validation
- Security Headers (Helmet)
- CORS Protection
- Rate Limiting (planned)

## Future Enhancements

- Payment Gateway Integration
- Email Notifications
- Real-time Updates
- Analytics Dashboard
- Mobile App Support
- Advanced Search Features 