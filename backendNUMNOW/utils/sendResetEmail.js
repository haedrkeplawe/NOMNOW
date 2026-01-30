const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html }) => {
  // إنشاء transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER, // ايميلك
      pass: process.env.EMAIL_PASS, // app password
    },
  });

  // محتوى الإيميل
  const mailOptions = {
    from: `"Your App" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  // إرسال الإيميل
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
