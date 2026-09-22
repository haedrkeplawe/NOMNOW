// === RESTAURANT ===
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // v4.8 — نحتفظ بالتوكن بـ ref كمان حتى الـ interceptor (المسجَّل مرة
  // وحدة فقط تحت) يقرأ دايماً آخر قيمة، بدل ما يعلق على القيمة وقت
  // إنشاء الـ instance (مشكلة الـ closure القديم)
  const accessTokenRef = useRef(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  // v4.8 — axios instance واحد ثابت طول عمر الكومبوننت، بدل ما ينعمل
  // instance جديد (ومعه interceptors جديدة تتراكم) بكل render
  const apiRef = useRef(null);
  if (!apiRef.current) {
    apiRef.current = axios.create({
      baseURL: process.env.REACT_APP_API_URL,
      withCredentials: true,
    });
  }
  const api = apiRef.current;

  // v4.8 — الطلب الوحيد الجاري حالياً لتجديد التوكن (لو موجود). هاد هو
  // الإصلاح الأساسي لمشكلة "تسجيل خروج عشوائي": قبل هيك كل طلب فشل بـ401
  // كان يبعث نداء /refreshtoken منفصل خاص فيه. الباك اند بيعمل refresh
  // token rotation (كل نداء بيلغي القديم ويطلع جديد)، فلو وصل أكتر من
  // نداء بنفس اللحظة (بالضبط سيناريو "النت رجع وكل مكوّن عم يطلق طلبه")
  // بس الأول كان ينجح، والباقي كانوا يوصلوا بتوكن صار قديم توّاً فيترفضوا
  // بـ403 ويسبب logout فوري رغم إنو الجلسة كانت لسا صالحة. هلق كل الطلبات
  // المتزامنة بتستنى نفس نداء الـ refresh هاد بدل ما توصل كل وحدة لحالها.
  const refreshPromiseRef = useRef(null);

  const performRefresh = useCallback(async () => {
    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = axios
        .post(
          `${process.env.REACT_APP_API_URL}/restaurant/refreshtoken`,
          {},
          { withCredentials: true },
        )
        .then((res) => {
          setAccessToken(res.data.accessToken);
          accessTokenRef.current = res.data.accessToken;
          if (res.data.user) setUser(res.data.user);
          return res.data.accessToken;
        })
        .finally(() => {
          refreshPromiseRef.current = null;
        });
    }
    return refreshPromiseRef.current;
  }, []);

  // Logout
  const logout = useCallback(async () => {
    try {
      // v4.8 — كان عم يضرب "/auth/logout" (مسار غير موجود أصلاً بالراوتس)
      // فما كان refreshToken بقاعدة البيانات ينلغى فعلياً عند تسجيل الخروج.
      // المسار الصحيح المسجَّل بـ restaurant.routes.js هو "/restaurant/logout"
      await api.post("/restaurant/logout");
    } catch (err) {
      console.error(err);
    }

    setAccessToken(null);
    accessTokenRef.current = null;
    setUser(null);
    window.location.href = "/login";
  }, [api]);

  // v4.8 — نسجّل الـ interceptors مرة وحدة بس (مش بكل render) على نفس
  // الـ instance الثابت فوق
  const interceptorsAttached = useRef(false);
  useEffect(() => {
    if (interceptorsAttached.current) return;
    interceptorsAttached.current = true;

    // Attach access token
    api.interceptors.request.use((config) => {
      if (accessTokenRef.current) {
        config.headers.Authorization = `Bearer ${accessTokenRef.current}`;
      }
      return config;
    });

    // Auto refresh on 401 — عبر performRefresh المشتركة (بدون سباق)
    api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await performRefresh();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          } catch (err) {
            logout();
            return Promise.reject(err);
          }
        }

        return Promise.reject(error);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔁 Check auth on app start — عبر نفس performRefresh المشتركة
  useEffect(() => {
    const initAuth = async () => {
      try {
        await performRefresh();
      } catch (err) {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Login (بعد OTP)
  const login = (token, userData) => {
    setAccessToken(token);
    accessTokenRef.current = token;
    setUser(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        api,
        loading,
        // v4.8 — مطلوبة من RestaurantContext.js (مسار تعافي السوكيت من
        // انتهاء صلاحية التوكن) — كانت غير موجودة أصلاً بالـ context القديم
        refreshAccessToken: performRefresh,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
