require("dotenv").config();

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { Pool } = require("pg");

// Firebase Admin (solo para verificar tokens de Google)
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

// PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const server = express();
server.use(cors());
server.use(express.json());

// Middleware: verifica el token de Firebase y adjunta el usuario
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized: No token provided");
  }
  try {
    const token = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // { uid, email, ... }
    next();
  } catch (error) {
    return res.status(401).send("Unauthorized: Invalid token");
  }
};

// Registra al usuario en postgres si es la primera vez que hace login
const syncUser = async (uid, email) => {
  await pool.query(
    `INSERT INTO users (uid, email) VALUES ($1, $2) ON CONFLICT (uid) DO NOTHING`,
    [uid, email]
  );
};

// GET /products - catálogo con precios
server.get("/products", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products ORDER BY id");
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// PUT /admin/products/:id - actualizar precio (solo admin)
server.put("/admin/products/:id", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { price_piece, price_kg } = req.body;
    await pool.query(
      "UPDATE products SET price_piece = $1, price_kg = $2 WHERE id = $3",
      [price_piece, price_kg, req.params.id]
    );
    res.status(200).send("Price updated");
  } catch (error) {
    res.status(500).send(error.message);
  }
});


server.get("/admin/orders", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query(
      "SELECT is_admin FROM users WHERE uid = $1",
      [req.user.uid]
    );
    if (!user.length || !user[0].is_admin) {
      return res.status(403).send("Unauthorized: Only admins can access this endpoint");
    }
    const { rows } = await pool.query("SELECT o.*, u.email as user_email FROM orders o JOIN users u ON o.uid = u.uid");
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).send(error.message);
  }
});

// PATCH /admin/orders/:id/status - actualizar status de una orden
server.patch("/admin/orders/:id/status", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query(
      "SELECT is_admin FROM users WHERE uid = $1",
      [req.user.uid]
    );
    if (!user.length || !user[0].is_admin) {
      return res.status(403).send("Unauthorized");
    }
    const { status } = req.body;
    const validStatuses = ["pending", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).send("Invalid status");
    }
    await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.status(200).send("Status updated");
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).send(error.message);
  }
});


server.get("/orders", authenticate, async (req, res) => {
  try {
    await syncUser(req.user.uid, req.user.email);
    const { rows } = await pool.query(
      "SELECT * FROM orders WHERE uid = $1",
      [req.user.uid]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).send(error.message);
  }
});

// POST /orders - crear orden
server.post("/orders", authenticate, async (req, res) => {
  try {
    await syncUser(req.user.uid, req.user.email);
    const { products } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO orders (uid, products) VALUES ($1, $2) RETURNING id",
      [req.user.uid, JSON.stringify(products)]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).send(error.message);
  }
});

// PUT /orders/:id - actualizar orden completa
server.put("/orders/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { products } = req.body;
    const { rows } = await pool.query(
      "SELECT uid FROM orders WHERE id = $1",
      [id]
    );
    if (!rows.length) return res.status(404).send("Order not found");
    if (rows[0].uid !== req.user.uid) return res.status(403).send("Unauthorized");

    await pool.query("UPDATE orders SET products = $1 WHERE id = $2", [
      JSON.stringify(products),
      id,
    ]);
    res.status(200).send("Order updated successfully");
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).send(error.message);
  }
});

// DELETE /orders/:id - eliminar orden
server.delete("/orders/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "SELECT uid FROM orders WHERE id = $1",
      [id]
    );
    if (!rows.length) return res.status(404).send("Order not found");
    if (rows[0].uid !== req.user.uid) return res.status(403).send("Unauthorized");

    await pool.query("DELETE FROM orders WHERE id = $1", [id]);
    res.status(200).send("Order deleted successfully");
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).send(error.message);
  }
});

// DELETE /orders/:orderId/products/:productIndex - eliminar un producto de una orden
server.delete("/orders/:orderId/products/:productIndex", authenticate, async (req, res) => {
  try {
    const { orderId, productIndex } = req.params;
    const { rows } = await pool.query(
      "SELECT uid, products FROM orders WHERE id = $1",
      [orderId]
    );
    if (!rows.length) return res.status(404).send("Order not found");
    if (rows[0].uid !== req.user.uid) return res.status(403).send("Unauthorized");

    const products = rows[0].products;
    products.splice(Number(productIndex), 1);

    await pool.query("UPDATE orders SET products = $1 WHERE id = $2", [
      JSON.stringify(products),
      orderId,
    ]);
    res.status(200).send("Item deleted successfully");
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).send(error.message);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
