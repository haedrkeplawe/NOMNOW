module.exports = {
  send: async (phone, message) => {
    console.log("====================================");
    console.log("📩 Fake SMS (Development Mode)");
    console.log("To:", phone);
    console.log("Message:", message);
    console.log("====================================");
    return true;
  },
};
