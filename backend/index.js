require("dotenv").config(); // Load environment variables from .env file

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK using environment variables
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // Fix newline characters
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

console.log("Firebase Admin SDK initialized successfully!");

const db = admin.firestore();
const server = express();
server.use(cors());
server.use(express.json());

const ADMIN_EMAILS = ["lro.lomeli@gmail.com"]; // Add admin emails here

server.get("/admin/orders", async (req, res) => {
  try {
    const { uid } = req.query;
    const user = await admin.auth().getUser(uid); // Fetch user details
    const isAdmin = ADMIN_EMAILS.includes(user.email); // Check if user is admin

    if (!isAdmin) {
      return res.status(403).send("Unauthorized: Only admins can access this endpoint");
    }

    const snapshot = await db.collection("orders").get(); // Fetch all orders
    const orders = [];
    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).send(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).send(error);
  }
});

// Get all orders
server.get("/orders", async (req, res) => {
  try {
    const { uid } = req.query;
    const snapshot = await db.collection("orders").where("uid", "==", uid).get();
    const orders = [];
    //console.log(snapshot);
    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });
    console.log(orders);
    res.status(200).send(orders);
  } catch (error) {
    console.error("Error reading from Firestore:", error);
    res.status(500).send(error);
  }
});

// Add an order
server.post("/orders", async (req, res) => {
  try {
    const { uid, products } = req.body;
    const order = { uid, products };
    const docRef = await db.collection("orders").add(order);
    res.status(201).send({ id: docRef.id });
  } catch (error) {
    console.error("Error writing to Firestore:", error);
    res.status(500).send(error);
  }
});

// Update an order
server.put("/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { uid, products } = req.body;

    const orderRef = db.collection("orders").doc(id);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).send("Order not found");
    }

    const orderData = orderDoc.data();
    if (orderData.uid !== uid) {
      return res.status(403).send("You are not authorized to modify this order");
    }

    await orderRef.update({ products }); // Update the entire products array
    res.status(200).send("Order updated successfully");
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).send(error);
  }
});

// Delete an order
server.delete("/orders/:id", async (req, res) => {
  try {

    const { id } = req.params;
    const { uid } = req.body;

    const orderRef = db.collection("orders").doc(id);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) {
      return res.status(404).send("Order not found");
    }

    await orderRef.delete();
    res.status(200).send("Order deleted successfully");
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).send(error);
  }
});

server.delete('/orders/:orderId/products/:productIndex', async (req, res) => {
  try {
    const { orderId, productIndex } = req.params;

    console.log(orderId, productIndex);

    const orderRef = db.collection("orders").doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).send("Order not found");
    }

    
    const orderData = orderDoc.data();
    console.log("you");
    // Filter out the item to delete
    orderData.products.splice(productIndex, 1);

    await orderRef.update({ products: orderData.products });

    res.status(200).send("Item deleted successfully");
    console.log("nice");

  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).send(error);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
