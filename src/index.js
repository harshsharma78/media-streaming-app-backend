import dotenv from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({ path: "../.env" });

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is listening at port: ${process.env.PORT}`);
    });
  })
  .catch(err => console.log("MongoDB connection failed!!", err));

/* (async () => {
  try {
    await mongoose.connect(`${"mongodb+srv://namastecoding:mongodbwithnextjs@lessons.ckchu.mongodb.net"}/${DB_NAME}`);

    app.on("error", error =>
      console.log("Error while connecting to DB", error),
    );

    app.listen(process.env.PORT, () => console.log("Server is listening..."));
  } catch (error) {
    console.error(error);
    throw error;
  }
})(); */
