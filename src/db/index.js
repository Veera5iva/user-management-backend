import mongoose from "mongoose";
import { DB_NAME } from "../contants.js";

const connectDB = async() => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\nDB connection established! \nDB host: ${connectionInstance.connection.host}`);

    } catch (error) {
        console.log("MongoDB connection error", error);
        process.exit(1);
    }
}

export default connectDB;