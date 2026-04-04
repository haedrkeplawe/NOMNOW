const { io } = require("socket.io-client");

const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NWRjOTUzM2FlMTY5NWNkZTRmNmI4OSIsImlhdCI6MTc3MjY0OTM5OSwiZXhwIjoxNzczMjU0MTk5fQ.YSGVt7fI9PD5C2lGGWghAfAtKUpk-0xv-Jph4xx9ALY";

const socket = io("http://localhost:4000/user", {
  auth: { token },
});

socket.on("connect", () => {
  console.log("✅ Connected as User:", socket.id);

  // إرسال طلب تجريبي للمطعم
  socket.emit("order:create", {
    restaurantId: "64f123abc456def789", // ضع هنا ID مطعم حقيقي من DB
    items: [
      { name: "Pizza", qty: 2 },
      { name: "Coke", qty: 1 },
    ],
  });
});

socket.on("order:created", (order) => {
  console.log("📦 Order Created:", order);
});

socket.on("order:error", (err) => {
  console.error("❌ Order Error:", err);
});

socket.on("connect_error", (err) => {
  console.log("❌ Connection Error:", err.message);
});

socket.on("disconnect", () => {});
