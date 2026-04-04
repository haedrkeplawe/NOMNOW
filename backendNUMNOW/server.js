require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");

connectDB();
// TODO 5

const app = express();

/* -------------------- Middlewares -------------------- */
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5000",
      "https://nomnow-1.onrender.com",
      "https://nomnow-restaurant.onrender.com",
    ],
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
/* -------------------- Routes -------------------- */
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/restaurant", require("./routes/restaurant.routes"));
app.use("/api/user", require("./routes/user.routes"));
app.use("/api/driver", require("./routes/driver.routes"));

/* -------------------- Create HTTP Server -------------------- */
const server = http.createServer(app);

/* -------------------- Socket.io -------------------- */
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5000",
      "https://nomnow-1.onrender.com",
      "https://nomnow-restaurant.onrender.com",
    ],
    credentials: true,
  },
});

const adminNS = io.of("/admin");
const driverNS = io.of("/driver");
const restaurantNS = io.of("/restaurant");
const userNS = io.of("/user");

const socketAuth = require("./sockets/middlewares/socketAuth");
const driverSocketAuth = require("./sockets/middlewares/driverSocketAuth");
const initSockets = require("./sockets");
const restaurantSocketAuth = require("./sockets/middlewares/restaurantSocketAuth");

// adminNS.use(socketAuth);
driverNS.use(driverSocketAuth);
restaurantNS.use(restaurantSocketAuth);
userNS.use(socketAuth);

initSockets({ io, adminNS, driverNS, restaurantNS, userNS });

/* -------------------- Start Server -------------------- */
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
