import dotenv from "dotenv";
import { app } from "./app.js";
import connectDB from "./db/index.js";

dotenv.config({
    path: "./.env"
})

const PORT = process.env.PORT || 8000;

connectDB()
.then(() => {
    app.listen(PORT, () => {
        console.log(`The port is running at ${PORT}`);
        console.log("index: ok");
        
    })
})
.catch((err) => {
    console.log("MongoDb connection errror", err);
    
})