import mongoose from 'mongoose';
import AppError from '../utils/Error/AppError.js';
import dotenv from 'dotenv';
dotenv.config();

const connectDB = async() => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("Database connected successfully");
    } catch (error) {
        console.error("Error connecting to the database:", error);
        throw new AppError('Database connection failed', 500);
    }
}

export default connectDB;