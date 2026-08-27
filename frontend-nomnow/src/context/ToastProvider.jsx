import { Toaster } from "react-hot-toast";
import { createPortal } from "react-dom";

const ToastProvider = () => {
  return createPortal(
    <Toaster
      position="top-right"
      containerStyle={{
        zIndex: 2147483647,
      }}
    />,
    document.body,
  );
};

export default ToastProvider;
