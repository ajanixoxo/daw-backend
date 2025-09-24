#!/usr/bin/env node

/**
 * Script to sync Payment model indexes
 * This will drop all indexes except _id from the payments collection
 * Run this when your MongoDB is running
 */

const mongoose = require('mongoose');

// Load environment variables
require('dotenv').config();

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/testAPI';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const syncPaymentIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection('payments');
    
    console.log('\n📋 Current indexes in payments collection:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    console.log('\n🗑️  Dropping all indexes except _id...');
    let droppedCount = 0;
    
    for (const index of indexes) {
      if (index.name !== '_id_') {
        try {
          await collection.dropIndex(index.name);
          console.log(`  ✅ Dropped: ${index.name}`);
          droppedCount++;
        } catch (error) {
          console.log(`  ⚠️  Could not drop ${index.name}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n📊 Summary: Dropped ${droppedCount} indexes`);
    
    console.log('\n📋 Final indexes in payments collection:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    console.log('\n✅ Payment model indexes synced successfully!');
    console.log('   Only _id index remains as requested.');
    
  } catch (error) {
    console.error('❌ Error syncing indexes:', error.message);
  }
};

const main = async () => {
  try {
    await connectDB();
    await syncPaymentIndexes();
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
main();
