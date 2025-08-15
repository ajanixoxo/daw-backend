# Digital African Women Backend

A comprehensive e-commerce backend API with user authentication, product management, cart functionality, and order processing.

## Features

- User authentication and authorization (Admin, Seller, Buyer roles)
- Product management with approval workflow
- Shopping cart functionality
- Order processing
- **Stock/Inventory Management System**
- Role-based access control
- Input validation and security

## Stock Management API

### Admin Stock Management Endpoints

#### Get All Products with Stock Information
```
GET /api/stock
Authorization: Bearer <admin_token>
Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 10)
- sortBy: Sort field (default: 'title')
- sortOrder: 'asc' or 'desc' (default: 'asc')
- status: Filter by stock status ('In Stock', 'Low Stock', 'Out of Stock')
- category: Filter by category
- lowStock: true/false - Show only low stock items
- outOfStock: true/false - Show only out of stock items
- search: Text search in product fields
```

#### Get Product Stock Details
```
GET /api/stock/:id
Authorization: Bearer <admin_token>
```

#### Update Stock Quantity
```
PUT /api/stock/:id/update
Authorization: Bearer <admin_token>
Body: {
  "quantity": 50,
  "reason": "Restocking from supplier"
}
```

#### Adjust Stock by Amount
```
POST /api/stock/:id/adjust
Authorization: Bearer <admin_token>
Body: {
  "adjustment": -5,  // Negative for removal, positive for addition
  "reason": "Damaged goods removed"
}
```

#### Get Low Stock Alerts
```
GET /api/stock/alerts/low-stock
Authorization: Bearer <admin_token>
```

#### Get Stock History
```
GET /api/stock/:id/history
Authorization: Bearer <admin_token>
Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 20)
```

#### Export Stock Report
```
GET /api/stock/reports/export
Authorization: Bearer <admin_token>
Query Parameters:
- format: 'json' or 'csv' (default: 'json')
```

#### Bulk Update Stock
```
POST /api/stock/bulk-update
Authorization: Bearer <admin_token>
Body: {
  "updates": [
    { "productId": "product_id_1", "quantity": 100 },
    { "productId": "product_id_2", "quantity": 50 }
  ],
  "reason": "Monthly inventory update"
}
```

### Product Model Changes

The Product model now includes these inventory-related fields:

- `inventory`: Current stock count
- `stockStatus`: Automatically calculated ('In Stock', 'Low Stock', 'Out of Stock')
- `lowStockThreshold`: Threshold for low stock alerts (default: 10)
- `sku`: Stock Keeping Unit (optional)
- `weight`: Product weight (optional)
- `dimensions`: Product dimensions (length, width, height)
- `stockHistory`: Array of stock change records with timestamps and reasons

### Stock Status Automation

- Stock status is automatically updated based on inventory levels
- Low stock alerts are generated when inventory falls below threshold
- Stock history is maintained for all changes with user tracking

### Permissions

Stock management requires these permissions:
- `VIEW_STOCK`: View stock information
- `MANAGE_STOCK`: Update stock quantities
- `ADJUST_STOCK`: Make stock adjustments
- `VIEW_STOCK_HISTORY`: View stock change history
- `VIEW_LOW_STOCK_ALERTS`: View low stock alerts
- `EXPORT_STOCK_REPORT`: Export stock reports

### Role Access

- **Admin**: Full access to all stock management features
- **Seller**: Can view stock information for their own products only
- **Buyer**: No stock management access (only sees product availability)

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env` file
4. Start the server: `npm start`

## API Documentation

Base URL: `http://localhost:5000/api`

### Authentication Required
Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Error Responses
All endpoints return errors in this format:
```json
{
  "message": "Error description",
  "error": "Detailed error message (in development)"
}
```

### Success Responses
Stock management endpoints return data in this format:
```json
{
  "products": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalProducts": 50,
    "limit": 10
  },
  "stats": {
    "totalProducts": 50,
    "inStock": 30,
    "lowStock": 15,
    "outOfStock": 5,
    "totalInventoryValue": 15000.00
  }
}
``` 