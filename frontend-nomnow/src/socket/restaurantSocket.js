import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;

export const createRestaurantSocket = (accessToken) => {
  return io(`${SOCKET_URL}/restaurant`, {
    auth: { token: accessToken },
    withCredentials: true,
    autoConnect: false, // نتحكم بالاتصال بعد ما نتأكد من صلاحية التوكن
    reconnection: true, // إعادة الاتصال تلقائياً عند الانقطاع
    reconnectionAttempts: Infinity, // نحاول بلا حد
    reconnectionDelay: 1000, // نبدأ بـ 1 ثانية
    reconnectionDelayMax: 10000, // حد أقصى 10 ثوانٍ بين المحاولات
    timeout: 20000, // timeout للاتصال الأولي
  });
};
