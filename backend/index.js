require("dotenv").config();

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { Pool } = require("pg");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const runSetup = require("./db/setup");

const upload = multer({ storage: multer.memoryStorage() });

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

// Verifica si el usuario está aprobado
const isApproved = async (uid) => {
  const { rows } = await pool.query("SELECT is_approved, is_admin FROM users WHERE uid = $1", [uid]);
  if (!rows.length) return false;
  return rows[0].is_approved || rows[0].is_admin;
};

// GET /me - verifica si el usuario autenticado está aprobado
server.get("/me", authenticate, async (req, res) => {
  try {
    await syncUser(req.user.uid, req.user.email);
    const { rows } = await pool.query(
      "SELECT is_approved, is_admin FROM users WHERE uid = $1",
      [req.user.uid]
    );
    if (!rows.length) return res.status(200).json({ approved: false });
    res.status(200).json({ approved: rows[0].is_approved || rows[0].is_admin });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// GET /admin/users - listar todos los usuarios (solo admin)
server.get("/admin/users", authenticate, async (req, res) => {
  try {
    const { rows: admin } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!admin.length || !admin[0].is_admin) return res.status(403).send("Unauthorized");
    const { rows } = await pool.query("SELECT id, uid, email, is_admin, is_approved FROM users ORDER BY id DESC");
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// PATCH /admin/users/:uid/approve - aprobar o rechazar usuario
server.patch("/admin/users/:uid/approve", authenticate, async (req, res) => {
  try {
    const { rows: admin } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!admin.length || !admin[0].is_admin) return res.status(403).send("Unauthorized");
    const { approved } = req.body;
    await pool.query("UPDATE users SET is_approved = $1 WHERE uid = $2", [approved, req.params.uid]);
    res.status(200).send("User updated");
  } catch (error) {
    res.status(500).send(error.message);
  }
});


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

// POST /admin/products/bulk - actualizar todos los precios de un golpe
server.post("/admin/products/bulk", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { products } = req.body; // [{ id, price_piece, price_kg }]
    for (const p of products) {
      await pool.query(
        "UPDATE products SET price_piece = $1, price_kg = $2 WHERE id = $3",
        [p.price_piece, p.price_kg, p.id]
      );
    }
    res.status(200).json({ updated: products.length });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// POST /admin/products/csv - subir CSV con precios
server.post("/admin/products/csv", authenticate, upload.single("file"), async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const records = parse(req.file.buffer.toString(), {
      columns: true, skip_empty_lines: true, trim: true,
    });

    // Espera columnas: id, price_piece, price_kg
    let updated = 0;
    for (const row of records) {
      if (!row.id) continue;
      await pool.query(
        "UPDATE products SET price_piece = $1, price_kg = $2 WHERE id = $3",
        [parseFloat(row.price_piece) || 0, parseFloat(row.price_kg) || 0, parseInt(row.id)]
      );
      updated++;
    }
    res.status(200).json({ updated });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// POST /admin/products - create new product
server.post("/admin/products", authenticate, upload.single("image"), async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { name, price_piece, price_kg, category } = req.body;
    const imagePath = req.file ? `/assets/${req.file.originalname.replace(/\.[^/.]+$/, ".webp")}` : null;
    
    const { rows } = await pool.query(
      "INSERT INTO products (name, price_piece, price_kg, image, category) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, parseFloat(price_piece) || 0, parseFloat(price_kg) || 0, imagePath, category || 'general']
    );
    
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// DELETE /admin/products/:id - delete product
server.delete("/admin/products/:id", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { rows } = await pool.query("DELETE FROM products WHERE id = $1 RETURNING *", [req.params.id]);
    
    if (!rows.length) return res.status(404).send("Product not found");
    
    res.status(200).json({ message: "Product deleted successfully", product: rows[0] });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// PUT /admin/products/:id/details - update product details (name, image, category)
server.put("/admin/products/:id/details", authenticate, upload.single("image"), async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { name, category } = req.body;
    const imagePath = req.file ? `/assets/${req.file.originalname.replace(/\.[^/.]+$/, ".webp")}` : null;
    
    // Build dynamic update query
    let updateFields = [];
    let updateValues = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(name);
    }
    if (category !== undefined) {
      updateFields.push(`category = $${paramIndex++}`);
      updateValues.push(category);
    }
    if (imagePath !== null) {
      updateFields.push(`image = $${paramIndex++}`);
      updateValues.push(imagePath);
    }

    if (updateFields.length === 0) {
      return res.status(400).send("No fields to update");
    }

    updateValues.push(req.params.id);
    
    const { rows } = await pool.query(
      `UPDATE products SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateValues
    );
    
    if (!rows.length) return res.status(404).send("Product not found");
    
    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// GET /categories - fetch all categories
server.get("/categories", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM categories ORDER BY name");
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// POST /admin/categories - create new category
server.post("/admin/categories", authenticate, async (req, res) => {
  try {
    const { rows: user } = await pool.query("SELECT is_admin FROM users WHERE uid = $1", [req.user.uid]);
    if (!user.length || !user[0].is_admin) return res.status(403).send("Unauthorized");

    const { name } = req.body;
    const { rows } = await pool.query("INSERT INTO categories (name) VALUES ($1) RETURNING *", [name]);
    
    res.status(201).json(rows[0]);
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
    if (!await isApproved(req.user.uid)) return res.status(403).json({ reason: "not_approved" });
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
    if (!await isApproved(req.user.uid)) return res.status(403).json({ reason: "not_approved" });
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
server.listen(PORT, async () => {
  await runSetup(pool);
  console.log(`Server running on port ${PORT}`);
});
