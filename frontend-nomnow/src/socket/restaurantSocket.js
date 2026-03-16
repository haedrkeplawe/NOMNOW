import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL;

export const createRestaurantSocket = (accessToken) => {
  return io(`${SOCKET_URL}/restaurant`, {
    auth: { token: accessToken },
    withCredentials: true,
    autoConnect: false, // نتحكم بالاتصال بعد ما نتاكد من صلاحية التوكن
  });
};
