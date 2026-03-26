const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // ايميلك
    pass: process.env.EMAIL_PASS, // App Password من Google
  },
});

module.exports = {
  send: async (email, message) => {
    try {
      await transporter.sendMail({
        from: `"Your App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your Verification Code",
        text: message,
      });

      console.log("📩 Email Sent To:", email);
      return true;
    } catch (err) {
      console.error("❌ Email Error:", err);
      return false;
    }
  },
};
