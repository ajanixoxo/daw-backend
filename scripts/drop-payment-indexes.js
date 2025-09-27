const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/testAPI');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Drop all indexes except _id from payments collection
const dropPaymentIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection('payments');
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);
    
    // Drop all indexes except _id
    for (const index of indexes) {
      if (index.name !== '_id_') {
        console.log(`Dropping index: ${index.name}`);
        await collection.dropIndex(index.name);
      }
    }
    
    // Verify only _id index remains
    const remainingIndexes = await collection.indexes();
    console.log('Remaining indexes:', remainingIndexes);
    
    console.log('✅ Successfully removed all indexes except _id from payments collection');
  } catch (error) {
    console.error('Error dropping indexes:', error);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await dropPaymentIndexes();
  await mongoose.connection.close();
  console.log('Database connection closed');
};

main().catch(console.error);

