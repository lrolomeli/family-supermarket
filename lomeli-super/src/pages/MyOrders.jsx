import { useEffect, useState } from "react";
import { auth } from "../firebase";
import API_BASE_URL from "../config";
import apiFetch from "../api";
import { calcOrderTotal } from "../utils/pricing";
import Price from "../components/Price";

const STATUS_COLORS = {
  pending:     { bg: "#fffbeb", color: "#d97706", label: "Pendiente", icon: "🕐" },
  in_progress: { bg: "#eff6ff", color: "#2563eb", label: "En Progreso", icon: "📦" },
  delivered:   { bg: "#f0fdf4", color: "#16a34a", label: "Entregado", icon: "✅" },
  completed:   { bg: "#f0fdf4", color: "#16a34a", label: "Completado", icon: "✅" },
  cancelled:   { bg: "#fef2f2", color: "#dc2626", label: "Cancelado", icon: "❌" },
};

const StatusBadge = ({ status = "pending" }) => {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "4px 10px", borderRadius: "999px",
      fontSize: "11px", fontWeight: 700, letterSpacing: "0.3px",
      display: "inline-flex", alignItems: "center", gap: "4px",
    }}>
      {s.icon} {s.label}
    </span>
  );
};

const ActionBtn = ({ onClick, bg, color, children }) => (
  <button onClick={onClick} style={{
    padding: "10px 0", background: bg, color,
    border: "none", borderRadius: "10px", cursor: "pointer",
    fontSize: "13px", fontWeight: 600, flex: 1,
    WebkitTapHighlightColor: "transparent",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
  }}>
    {children}
  </button>
);

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editedProducts, setEditedProducts] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notification, setNotification] = useState(null);
  const [productCatalog, setProductCatalog] = useState([]);

  useEffect(() => {
    apiFetch(`${API_BASE_URL}/products`)
      .then(r => r.json())
      .then(data => setProductCatalog(data))
      .catch(console.error);
  }, []);

  const firebaseUser = auth.currentUser;
  const localUser = !firebaseUser ? JSON.parse(localStorage.getItem("local_user") || "null") : null;
  const isAuthenticated = !!firebaseUser || !!localUser;

  const showNotification = (title, message, type = 'success') => {
    setNotification({ title, message, type });
  };

  const handleSaveAsFavorite = async (order) => {
    const name = prompt("¿Cómo quieres llamar a este pedido favorito?");
    if (!name || !name.trim()) return;
    try {
      const response = await apiFetch(`${API_BASE_URL}/favorites`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), products: order.products }),
      });
      if (response.ok) {
        showNotification("Favorito Guardado", "Pedido guardado en tus favoritos.", 'success');
      } else {
        const errorData = await response.json();
        setError(errorData.message || "No se pudo guardar el favorito");
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error saving favorite:", err);
    }
  };

  const refreshOrders = async () => {
    const response = await apiFetch(`${API_BASE_URL}/orders`);
    const data = await response.json();
    setOrders(data);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshOrders().catch(e => console.error("Error fetching orders:", e));
  }, [isAuthenticated]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated) {
        refreshOrders().catch(e => console.error("Error refreshing orders:", e));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated]);

  const handleEditClick = (order) => {
    refreshOrders().catch(e => console.error("Error refreshing:", e));
    setEditingOrderId(order.id);
    setEditedProducts(order.products.map(p => ({ ...p })));
  };

  const handleCancelEdit = () => {
    if (editedProducts.length === 0 || confirm("¿Cancelar la edición?")) {
      setEditingOrderId(null);
      setEditedProducts([]);
      setError("");
      setSuccess("");
      refreshOrders().catch(e => console.error("Error refreshing:", e));
    }
  };

  const handleProductChange = (index, field, value) => {
    setEditedProducts(prev =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (field === "quantity") {
          const num = Number(value);
          const min = p.unit === "kg" ? 0.25 : 1;
          return { ...p, quantity: p.unit === "pieces" ? Math.max(1, Math.round(num)) : Math.max(min, num) };
        }
        if (field === "unit") {
          const newQty = value === "pieces" ? Math.max(1, Math.round(p.quantity)) : Math.max(0.25, p.quantity);
          return { ...p, unit: value, quantity: newQty };
        }
        return { ...p, [field]: value };
      })
    );
  };

  const handleSaveEdit = async (orderId) => {
    setError("");
    setSuccess("");
    const order = orders.find(o => o.id === orderId);
    if (order && order.status === 'in_progress') {
      await handleRequestChange(orderId, 'modify', editedProducts);
      return;
    }
    try {
      const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify({ products: editedProducts }),
      });
      if (response.ok) {
        showNotification("¡Pedido Actualizado!", "Tu pedido ha sido actualizado exitosamente.", 'success');
        setEditingOrderId(null);
        await refreshOrders();
      } else {
        const errorData = await response.json();
        setError(errorData.message || "No se pudo actualizar el pedido");
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error updating order:", err);
    }
  };

  const handleDeleteProduct = async (orderId, productIndex) => {
    setError("");
    setSuccess("");
    if (editingOrderId === orderId) {
      const product = editedProducts[productIndex];
      if (!confirm(`¿Eliminar "${product.name}" del pedido?`)) return;
      const remaining = editedProducts.filter((_, i) => i !== productIndex);
      if (remaining.length === 0) {
        if (!confirm("El pedido se quedará sin productos. ¿Eliminar el pedido completo?")) return;
        await handleRemoveOrder(orderId);
        setEditingOrderId(null);
        return;
      }
      setEditedProducts(remaining);
      setSuccess("Producto eliminado. Guarda los cambios para aplicar.");
      setTimeout(() => setSuccess(""), 3000);
      return;
    }
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/orders/${orderId}/products/${productIndex}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        setSuccess("Producto eliminado del pedido");
        await refreshOrders();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "No se pudo eliminar el producto");
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error deleting product:", err);
    }
  };

  const handleRemoveOrder = async (id) => {
    setError("");
    setSuccess("");
    if (!confirm("¿Eliminar este pedido?")) return;
    try {
      const response = await apiFetch(`${API_BASE_URL}/orders/${id}`, { method: "DELETE" });
      if (response.ok) {
        setSuccess("Pedido eliminado exitosamente");
        await refreshOrders();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "No se pudo eliminar el pedido");
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error deleting order:", err);
    }
  };

  const handleRequestChange = async (orderId, requestType = "modify", editedProductsData = null) => {
    let message = "";
    if (requestType === "modify" && editedProductsData) {
      const order = orders.find(o => o.id === orderId);
      const changes = [];
      editedProductsData.forEach((newProduct) => {
        const oldProduct = order?.products?.find(p => p.name === newProduct.name);
        if (oldProduct) {
          if (oldProduct.quantity !== newProduct.quantity || oldProduct.unit !== newProduct.unit) {
            changes.push(`${newProduct.name}: ${oldProduct.quantity} ${oldProduct.unit} → ${newProduct.quantity} ${newProduct.unit}`);
          }
        } else {
          changes.push(`+ ${newProduct.name}: ${newProduct.quantity} ${newProduct.unit}`);
        }
      });
      const order2 = orders.find(o => o.id === orderId);
      order2?.products?.forEach(oldProduct => {
        if (!editedProductsData.find(p => p.name === oldProduct.name)) {
          changes.push(`- ${oldProduct.name}: ${oldProduct.quantity} ${oldProduct.unit}`);
        }
      });
      message = changes.length > 0 ? changes.join(', ') : "No se detectaron cambios";
    } else {
      message = prompt(
        requestType === "cancel"
          ? "¿Por qué necesitas cancelar este pedido?"
          : "Describe los cambios que necesitas en tu pedido:"
      );
      if (!message || !message.trim()) return;
    }
    setError("");
    setSuccess("");
    try {
      const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}/requests`, {
        method: "POST",
        body: JSON.stringify({
          request_type: requestType,
          message: message.trim(),
          proposed_changes: editedProductsData || null
        }),
      });
      if (response.ok) {
        showNotification(
          "Solicitud Enviada",
          requestType === "modify" && editedProductsData
            ? "Tus cambios han sido enviados al administrador para aprobación."
            : "Tu solicitud ha sido enviada al administrador.",
          'info'
        );
        if (requestType === "modify" && editedProductsData) setEditingOrderId(null);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "No se pudo enviar la solicitud");
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error requesting change:", err);
    }
  };

  const getProductImage = (name) => {
    const found = productCatalog.find(p => p.name === name);
    const img = found?.image;
    return img || '/images/default-product.svg';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ padding: "16px 16px 120px", maxWidth: "600px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "16px" }}>
        <h2 style={{ margin: "0 0 4px", color: "#111827", fontSize: "22px", fontWeight: 700 }}>
          Mis Pedidos
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
          Revisa y administra tus pedidos
        </p>
      </div>

      {/* Error / Success toasts */}
      {error && (
        <div style={{
          marginBottom: "12px", padding: "10px 14px", borderRadius: "12px",
          background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
          fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} style={{
            background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "18px", padding: "0 0 0 8px",
          }}>×</button>
        </div>
      )}
      {success && (
        <div style={{
          marginBottom: "12px", padding: "10px 14px", borderRadius: "12px",
          background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a",
          fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>✅ {success}</span>
          <button onClick={() => setSuccess("")} style={{
            background: "none", border: "none", color: "#16a34a", cursor: "pointer", fontSize: "18px", padding: "0 0 0 8px",
          }}>×</button>
        </div>
      )}

      {/* Empty state */}
      {orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#d1d5db" }}>
          <div style={{ fontSize: "48px", marginBottom: "8px" }}>📋</div>
          <p style={{ margin: 0, fontSize: "14px", color: "#9ca3af" }}>Aún no tienes pedidos</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {orders.map(order => {
            const isEditing = editingOrderId === order.id;
            const statusInfo = STATUS_COLORS[order.status] || STATUS_COLORS.pending;
            const total = productCatalog.length > 0 ? calcOrderTotal(order.products, productCatalog) : null;

            return (
              <div key={order.id} style={{
                borderRadius: "14px", background: "#fff", overflow: "hidden",
                border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                {/* Order header */}
                <div style={{
                  padding: "12px 14px", background: "#f9fafb",
                  borderBottom: "1px solid #f3f4f6",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>
                      Pedido #{order.id}
                    </div>
                    {order.created_at && (
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                        {formatDate(order.created_at)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {total !== null && (
                      <Price value={total} style={{ fontWeight: 700, color: "#15803d", fontSize: "14px" }} />
                    )}
                    <StatusBadge status={order.status} />
                  </div>
                </div>

                {/* Products */}
                <div style={{ padding: "10px 14px" }}>
                  {isEditing ? (
                    /* Edit mode */
                    <div>
                      {editedProducts.map((product, index) => (
                        <div key={index} style={{
                          display: "flex", alignItems: "center", gap: "8px",
                          padding: "8px 0",
                          borderBottom: index < editedProducts.length - 1 ? "1px solid #f3f4f6" : "none",
                        }}>
                          <img src={getProductImage(product.name)} alt={product.name}
                            style={{ width: "34px", height: "34px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: "13px", color: "#374151", fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {product.name}
                          </span>
                          <input
                            type="number" min={product.unit === "kg" ? "0.25" : "1"} step={product.unit === "kg" ? "0.25" : "1"} value={product.quantity}
                            onChange={e => handleProductChange(index, "quantity", e.target.value)}
                            style={{
                              width: "50px", padding: "6px 4px", borderRadius: "8px",
                              border: "1.5px solid #d1d5db", fontSize: "14px", textAlign: "center",
                            }}
                          />
                          <select
                            value={product.unit}
                            onChange={e => handleProductChange(index, "unit", e.target.value)}
                            style={{
                              padding: "6px 4px", borderRadius: "8px",
                              border: "1.5px solid #d1d5db", fontSize: "13px", background: "#fff",
                            }}
                          >
                            <option value="pieces">pz</option>
                            <option value="kg">kg</option>
                          </select>
                          <button onClick={() => handleDeleteProduct(order.id, index)} style={{
                            background: "#fef2f2", border: "none", color: "#ef4444",
                            width: "30px", height: "30px", borderRadius: "8px",
                            fontSize: "14px", cursor: "pointer", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            WebkitTapHighlightColor: "transparent",
                          }}>✕</button>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <ActionBtn onClick={() => handleSaveEdit(order.id)} bg="#15803d" color="#fff">
                          💾 Guardar
                        </ActionBtn>
                        <ActionBtn onClick={handleCancelEdit} bg="#f3f4f6" color="#374151">
                          Cancelar
                        </ActionBtn>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div>
                      {order.products.map((product, idx) => (
                        <div key={idx} style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "6px 0",
                          borderBottom: idx < order.products.length - 1 ? "1px solid #f3f4f6" : "none",
                        }}>
                          <img src={getProductImage(product.name)} alt={product.name}
                            style={{ width: "32px", height: "32px", borderRadius: "8px", objectFit: "cover", flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: "13px", color: "#374151", fontWeight: 500 }}>
                            {product.name}
                          </span>
                          <span style={{ fontSize: "12px", color: "#6b7280", whiteSpace: "nowrap" }}>
                            {product.quantity} {product.unit === "pieces" ? "pz" : "kg"}
                          </span>
                        </div>
                      ))}

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                        {order.status !== 'delivered' && (
                          <ActionBtn onClick={() => handleEditClick(order)} bg="#eff6ff" color="#2563eb">
                            ✏️ Editar
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={() => handleSaveAsFavorite(order)} bg="#fffbeb" color="#d97706">
                          ⭐ Favorito
                        </ActionBtn>
                        {order.status !== 'in_progress' && order.status !== 'delivered' && (
                          <ActionBtn onClick={() => handleRemoveOrder(order.id)} bg="#fef2f2" color="#dc2626">
                            🗑️
                          </ActionBtn>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notification Modal */}
      {notification && (
        <>
          <div onClick={() => setNotification(null)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300,
          }} />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: "#fff", borderRadius: "16px", padding: "24px 20px",
            maxWidth: "340px", width: "85%", zIndex: 301,
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)", textAlign: "center",
          }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 14px", fontSize: "22px",
              background: notification.type === 'success' ? '#dcfce7' : notification.type === 'info' ? '#dbeafe' : '#fef2f2',
              color: notification.type === 'success' ? '#166534' : notification.type === 'info' ? '#1d4ed8' : '#dc2626',
            }}>
              {notification.type === 'success' ? '✓' : notification.type === 'info' ? 'ℹ' : '⚠'}
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: 700, color: "#111827" }}>
              {notification.title}
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: "13px", color: "#6b7280", lineHeight: 1.5 }}>
              {notification.message}
            </p>
            <button onClick={() => setNotification(null)} style={{
              width: "100%", padding: "12px", border: "none", borderRadius: "10px",
              fontSize: "14px", fontWeight: 700, cursor: "pointer", color: "#fff",
              WebkitTapHighlightColor: "transparent",
              background: notification.type === 'success' ? '#15803d' : notification.type === 'info' ? '#2563eb' : '#dc2626',
            }}>
              Entendido
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MyOrders;
