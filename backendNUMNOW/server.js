require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");

connectDB();

const app = express();
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// TODO drivers backend
// TODO orders  in admin

app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/restaurant", require("./routes/restaurant.routes"));
app.use("/api/user", require("./routes/user.routes"));

app.listen(process.env.PORT || 4000, () => {
  console.log(`Server running on port ${process.env.PORT || 4000}`);
});

