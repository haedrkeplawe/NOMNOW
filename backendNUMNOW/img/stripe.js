// exports.createPaymentIntent = async (req, res) => {
//   try {
//     const order = await Order.findById(req.params.id);

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" });
//     }

//     if (order.orderStatus === "cancelled") {
//       return res.status(400).json({
//         message: "Cannot pay for cancelled order",
//       });
//     }

//     if (order.paymentStatus === "paid") {
//       return res.status(400).json({ message: "Order already paid" });
//     }

//     if (order.paymentDetails?.paymentIntentId) {
//       return res.status(400).json({
//         message: "Payment already initiated",
//       });
//     }

//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: Math.round(order.totalPrice * 100),
//       currency: "eur",
//       automatic_payment_methods: {
//         enabled: true,
//       },
//       metadata: {
//         orderId: order._id.toString(),
//       },
//     });

//     order.paymentStatus = "awaiting_payment";

//     order.paymentDetails = {
//       paymentIntentId: paymentIntent.id,
//       provider: "stripe",
//     };

//     await order.save();

//     res.json({
//       clientSecret: paymentIntent.client_secret,
//     });
//   } catch (error) {
//     res.status(500).json({
//       message: "Payment error",
//       error: error.message,
//     });
//   }
// };
// exports.stripeWebhook = async (req, res) => {
//   const sig = req.headers["stripe-signature"];

//   let event;

//   try {
//     event = stripe.webhooks.constructEvent(
//       req.body,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET,
//     );
//   } catch (err) {
//     console.error("Webhook signature verification failed:", err.message);

//     return res.status(400).send(`Webhook Error: ${err.message}`);
//   }

//   try {
//     switch (event.type) {
//       case "payment_intent.succeeded": {
//         const paymentIntent = event.data.object;
//         const orderId = paymentIntent.metadata.orderId;

//         if (!orderId) {
//           console.error("No orderId in metadata");
//           break;
//         }

//         const order = await Order.findById(orderId);
//         if (!order) break;

//         if (order.paymentStatus === "paid") {
//           console.log(`Order ${orderId} already processed`);
//           break; // يمنع التحديث مرة ثانية
//         }

//         await Order.findByIdAndUpdate(orderId, {
//           paymentStatus: "paid",
//           "paymentDetails.transactionId": paymentIntent.id,
//         });

//         console.log(`Order ${orderId} marked as paid`);
//         break;
//       }

//       case "payment_intent.payment_failed": {
//         const paymentIntent = event.data.object;

//         const orderId = paymentIntent.metadata.orderId;

//         if (!orderId) {
//           console.error("No orderId in metadata");
//           break;
//         }

//         await Order.findByIdAndUpdate(orderId, {
//           paymentStatus: "failed",
//         });

//         console.log(`Payment failed for order ${orderId}`);
//         break;
//       }

//       default:
//         console.log(`Unhandled event type ${event.type}`);
//     }

//     res.json({ received: true });
//   } catch (error) {
//     console.error("Webhook processing error:", error);

//     res.status(500).json({
//       message: "Webhook processing error",
//     });
//   }
// };

// exports.testStripe = async (req, res) => {
//   try {
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: 1000,
//       currency: "usd",
//       automatic_payment_methods: {
//         enabled: true,
//       },
//     });

//     res.json({
//       clientSecret: paymentIntent.client_secret,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       message: "Payment error",
//       error: error.message,
//     });
//   }
// };
