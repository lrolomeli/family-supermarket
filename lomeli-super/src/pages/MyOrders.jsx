import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import API_BASE_URL from "../config";
import apiFetch from "../api";
import productCatalog from "../data/products";
import { calcOrderTotal, formatMXN } from "../utils/pricing";

const STATUS_COLORS = {
  pending:   { bg: "#fff8e1", color: "#f59e0b", label: "Pending" },
  completed: { bg: "#e8f5e9", color: "#22c55e", label: "Completed" },
  cancelled: { bg: "#fce4ec", color: "#ef4444", label: "Cancelled" },
};

const StatusBadge = ({ status = "pending" }) => {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "2px 10px", borderRadius: "999px",
      fontSize: "12px", fontWeight: 600, textTransform: "uppercase",
    }}>
      {s.label}
    </span>
  );
};

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editedProducts, setEditedProducts] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const user = auth.currentUser;

  const refreshOrders = async () => {
    const response = await apiFetch(`${API_BASE_URL}/orders`);
    const data = await response.json();
    setOrders(data);
  };

  useEffect(() => {
    if (!user) return;
    refreshOrders().catch((e) => console.error("Error fetching orders:", e));
    fetch(`${API_BASE_URL}/products`)
      .then(r => r.json())
      .then(setCatalog)
      .catch(console.error);
  }, [user]);

  const handleEditClick = (order) => {
    setEditingOrderId(order.id);
    setEditedProducts(order.products.map((p) => ({ ...p })));
  };

  const handleCancelEdit = () => {
    setEditingOrderId(null);
    setEditedProducts([]);
  };

  const handleProductChange = (index, field, value) => {
    setEditedProducts((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, [field]: field === "quantity" ? Number(value) : value } : p
      )
    );
  };

  const handleSaveEdit = async (orderId) => {
    const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify({ products: editedProducts }),
    });
    if (response.ok) {
      setEditingOrderId(null);
      await refreshOrders();
    }
  };

  const handleDeleteProduct = async (orderId, productIndex) => {
    const response = await apiFetch(
      `${API_BASE_URL}/orders/${orderId}/products/${productIndex}`,
      { method: "DELETE" }
    );
    if (response.ok) await refreshOrders();
  };

  const handleRemoveOrder = async (id) => {
    if (!confirm("Remove this order?")) return;
    const response = await apiFetch(`${API_BASE_URL}/orders/${id}`, { method: "DELETE" });
    if (response.ok) await refreshOrders();
  };

  const getProductImage = (name) => {
    const found = productCatalog.find((p) => p.name === name);
    return found ? found.image : null;
  };

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px 16px" }}>
      <h2 style={{ marginBottom: "20px" }}>My Orders</h2>

      {orders.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "48px", background: "#f9f9f9",
          borderRadius: "12px", color: "#888"
        }}>
          <p style={{ fontSize: "18px" }}>No orders yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {orders.map((order) => (
            <div key={order.id} style={{
              border: "1px solid #e5e7eb", borderRadius: "12px",
              padding: "20px", background: "#fff",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
            }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <span style={{ fontWeight: 600, color: "#374151" }}>Order #{order.id}</span>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  {catalog.length > 0 && (
                    <span style={{ fontWeight: 700, color: "#22c55e", fontSize: "15px" }}>
                      {formatMXN(calcOrderTotal(order.products, catalog))}
                    </span>
                  )}
                  <StatusBadge status={order.status} />
                </div>
              </div>

              {/* Products */}
              {editingOrderId === order.id ? (
                <div>
                  {editedProducts.map((product, index) => (
                    <div key={index} style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "8px 0", borderBottom: "1px solid #f3f4f6"
                    }}>
                      {getProductImage(product.name) && (
                        <img src={getProductImage(product.name)} alt={product.name}
                          style={{ width: "36px", height: "36px", borderRadius: "6px", objectFit: "cover" }} />
                      )}
                      <span style={{ flex: 1, fontSize: "14px" }}>{product.name}</span>
                      <input
                        type="number" min="1" value={product.quantity}
                        onChange={(e) => handleProductChange(index, "quantity", e.target.value)}
                        style={{ width: "52px", padding: "4px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                      />
                      <select
                        value={product.unit}
                        onChange={(e) => handleProductChange(index, "unit", e.target.value)}
                        style={{ padding: "4px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                      >
                        <option value="pieces">pcs</option>
                        <option value="kg">kg</option>
                      </select>
                      <button onClick={() => handleDeleteProduct(order.id, index)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "18px" }}
                        title="Remove item">✕</button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                    <button onClick={() => handleSaveEdit(order.id)} style={{
                      padding: "7px 18px", background: "#22c55e", color: "#fff",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600
                    }}>Save</button>
                    <button onClick={handleCancelEdit} style={{
                      padding: "7px 18px", background: "#f3f4f6", color: "#374151",
                      border: "none", borderRadius: "8px", cursor: "pointer"
                    }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
                    {order.products.map((product, index) => (
                      <div key={index} style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        background: "#f9fafb", borderRadius: "8px", padding: "6px 10px"
                      }}>
                        {getProductImage(product.name) && (
                          <img src={getProductImage(product.name)} alt={product.name}
                            style={{ width: "28px", height: "28px", borderRadius: "4px", objectFit: "cover" }} />
                        )}
                        <span style={{ fontSize: "13px", color: "#374151" }}>
                          {product.name} — {product.quantity} {product.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => handleEditClick(order)} style={{
                      padding: "6px 16px", background: "#3b82f6", color: "#fff",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
                    }}>Edit</button>
                    <button onClick={() => handleRemoveOrder(order.id)} style={{
                      padding: "6px 16px", background: "#fee2e2", color: "#ef4444",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
                    }}>Remove</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyOrders;
