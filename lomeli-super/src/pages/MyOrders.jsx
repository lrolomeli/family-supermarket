import { useEffect, useState } from "react";
import { auth } from "../firebase";
import API_BASE_URL from "../config";
import apiFetch from "../api";
import { calcOrderTotal, formatMXN } from "../utils/pricing";

const STATUS_COLORS = {
  pending:     { bg: "#fff8e1", color: "#f59e0b", label: "Pendiente" },
  in_progress: { bg: "#dbeafe", color: "#3b82f6", label: "En Progreso" },
  delivered:   { bg: "#dcfce7", color: "#22c55e", label: "Entregado" },
  completed:   { bg: "#e8f5e9", color: "#22c55e", label: "Completado" },
  cancelled:   { bg: "#fce4ec", color: "#ef4444", label: "Cancelado" },
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notification, setNotification] = useState(null);
  const [productCatalog, setProductCatalog] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/products`)
      .then(r => r.json())
      .then(data => setProductCatalog(data))
      .catch(console.error);
  }, []);

  // Check for local user or Firebase user
  const firebaseUser = auth.currentUser;
  const localUser = !firebaseUser ? JSON.parse(localStorage.getItem("local_user") || "null") : null;
  const isAuthenticated = !!firebaseUser || !!localUser;

  const showNotification = (title, message, type = 'success') => {
    setNotification({
      title,
      message,
      type,
      timestamp: new Date()
    });
  };

  const closeNotification = () => {
    setNotification(null);
  };

  const handleSaveAsFavorite = async (order) => {
    const name = prompt("¿Cómo quieres llamar a este pedido favorito?");
    if (!name || !name.trim()) return;
    
    try {
      const response = await apiFetch(`${API_BASE_URL}/favorites`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          products: order.products
        }),
      });
      
      if (response.ok) {
        showNotification(
          "Favorito Guardado",
          "Este pedido ha sido guardado en tus favoritos para poder pedirlo nuevamente.",
          'success'
        );
      } else {
        const errorData = await response.json();
        setError(errorData.message || "No se pudo guardar el favorito");
      }
    } catch (error) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error saving favorite:", error);
    }
  };

  const refreshOrders = async () => {
    const response = await apiFetch(`${API_BASE_URL}/orders`);
    const data = await response.json();
    setOrders(data);
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshOrders().catch((e) => console.error("Error fetching orders:", e));
  }, [isAuthenticated]);

  // Refresh orders when page becomes visible (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated) {
        refreshOrders().catch((e) => console.error("Error refreshing orders on visibility change:", e));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated]);

  const handleEditClick = (order) => {
    // Refresh orders before editing to get latest status
    refreshOrders().catch((e) => console.error("Error refreshing orders before edit:", e));
    setEditingOrderId(order.id);
    setEditedProducts(order.products.map((p) => ({ ...p })));
  };

  const handleCancelEdit = () => {
    if (editedProducts.length === 0) {
      setEditingOrderId(null);
      setEditedProducts([]);
      return;
    }
    
    if (confirm("¿Cancelar la edición? Se perderán los cambios no guardados.")) {
      setEditingOrderId(null);
      setEditedProducts([]);
      setError("");
      setSuccess("");
      // Refresh after canceling to get latest status
      refreshOrders().catch((e) => console.error("Error refreshing orders after cancel:", e));
    }
  };

  const handleProductChange = (index, field, value) => {
    setEditedProducts((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, [field]: field === "quantity" ? Number(value) : value } : p
      )
    );
  };

  const handleSaveEdit = async (orderId) => {
    setError("");
    setSuccess("");
    
    // Find the order to check its status
    const order = orders.find(o => o.id === orderId);
    
    // If order is in progress, send as a request instead of updating directly
    if (order && order.status === 'in_progress') {
      await handleRequestChange(orderId, 'modify', editedProducts);
      return;
    }
    
    // Normal save for pending orders
    try {
      const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify({ products: editedProducts }),
      });
      
      if (response.ok) {
        showNotification(
          "¡Pedido Actualizado!",
          "Tu pedido ha sido actualizado exitosamente. Los cambios están listos.",
          'success'
        );
        setEditingOrderId(null);
        await refreshOrders();
      } else {
        const errorData = await response.json();
        setError(errorData.message || "No se pudo actualizar el pedido");
      }
    } catch (error) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error updating order:", error);
    }
  };

  const handleDeleteProduct = async (orderId, productIndex) => {
    setError("");
    setSuccess("");
    
    // If we're in edit mode, just remove from local state with confirmation
    if (editingOrderId === orderId) {
      const product = editedProducts[productIndex];
      if (!confirm(`¿Eliminar "${product.name}" del pedido?`)) {
        return;
      }
      
      setEditedProducts(prev => prev.filter((_, i) => i !== productIndex));
      setSuccess("Producto eliminado. Guarda los cambios para aplicar.");
      setTimeout(() => setSuccess(""), 3000);
      return;
    }
    
    // Otherwise, call the API directly
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
    } catch (error) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error deleting product:", error);
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
    } catch (error) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error deleting order:", error);
    }
  };

  const handleRequestChange = async (orderId, requestType = "modify", editedProductsData = null) => {
    let message = "";
    
    if (requestType === "modify" && editedProductsData) {
      // Create detailed message about the changes
      const order = orders.find(o => o.id === orderId);
      const changes = [];
      
      editedProductsData.forEach((newProduct, index) => {
        const oldProduct = order?.products?.find(p => p.name === newProduct.name);
        if (oldProduct) {
          if (oldProduct.quantity !== newProduct.quantity || oldProduct.unit !== newProduct.unit) {
            changes.push(`${newProduct.name}: ${oldProduct.quantity} ${oldProduct.unit} → ${newProduct.quantity} ${newProduct.unit}`);
          }
        } else {
          changes.push(`+ ${newProduct.name}: ${newProduct.quantity} ${newProduct.unit}`);
        }
      });
      
      // Check for removed products
      order?.products?.forEach(oldProduct => {
        const exists = editedProductsData.find(p => p.name === oldProduct.name);
        if (!exists) {
          changes.push(`- ${oldProduct.name}: ${oldProduct.quantity} ${oldProduct.unit}`);
        }
      });
      
      message = changes.length > 0 ? changes.join(', ') : "No se detectaron cambios";
    } else {
      // Regular request with prompt
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
        if (requestType === "modify" && editedProductsData) {
          showNotification(
            "Solicitud Enviada",
            "Tus cambios han sido enviados al administrador. Si los aprueba, tu pedido será actualizado automáticamente. Contacta al administrador para agilizar el proceso.",
            'info'
          );
          setEditingOrderId(null); // Exit edit mode after sending request
        } else {
          showNotification(
            "Solicitud Enviada", 
            "Tu solicitud ha sido enviada al administrador. Te notificaremos cuando responda.",
            'info'
          );
        }
      } else {
        const errorData = await response.json();
        setError(errorData.message || "No se pudo enviar la solicitud");
      }
    } catch (error) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error requesting change:", error);
    }
  };

  const getProductImage = (name) => {
    const found = productCatalog.find((p) => p.name === name);
    const img = found?.image;
    return img ? `${API_BASE_URL}${img}` : '/assets/default-product.svg';
  };

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px 16px" }}>
      <h2 style={{ marginBottom: "20px" }}>Mis Pedidos</h2>

      {/* Error and Success Messages */}
      {error && (
        <div style={{
          marginBottom: "16px", padding: "12px 16px", borderRadius: "8px",
          backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <span>⚠️ {error}</span>
          <button 
            onClick={() => setError("")}
            style={{
              background: "none", border: "none", color: "#dc2626", 
              cursor: "pointer", fontSize: "18px", padding: "0"
            }}
          >
            ×
          </button>
        </div>
      )}
      
      {success && (
        <div style={{
          marginBottom: "16px", padding: "12px 16px", borderRadius: "8px",
          backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <span>✅ {success}</span>
          <button 
            onClick={() => setSuccess("")}
            style={{
              background: "none", border: "none", color: "#16a34a", 
              cursor: "pointer", fontSize: "18px", padding: "0"
            }}
          >
            ×
          </button>
        </div>
      )}

      {orders.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "48px", background: "#f9f9f9",
          borderRadius: "12px", color: "#888"
        }}>
          <p style={{ fontSize: "18px" }}>Aún no tienes pedidos.</p>
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
                <span style={{ fontWeight: 600, color: "#374151" }}>Pedido #{order.id}</span>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  {productCatalog.length > 0 && (
                    <span style={{ fontWeight: 700, color: "#22c55e", fontSize: "15px" }}>
                      {formatMXN(calcOrderTotal(order.products, productCatalog))}
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
                      <img src={getProductImage(product.name)} alt={product.name}
                        style={{ width: "36px", height: "36px", borderRadius: "6px", objectFit: "cover" }} />
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
                        <option value="pieces">pzs</option>
                        <option value="kg">kg</option>
                      </select>
                      <button onClick={() => handleDeleteProduct(order.id, index)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "18px" }}
                        title="Eliminar producto">✕</button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                    <button onClick={() => handleSaveEdit(order.id)} style={{
                      padding: "7px 18px", background: "#22c55e", color: "#fff",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600
                    }}>Guardar</button>
                    <button onClick={handleCancelEdit} style={{
                      padding: "7px 18px", background: "#f3f4f6", color: "#374151",
                      border: "none", borderRadius: "8px", cursor: "pointer"
                    }}>Cancelar</button>
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
                        <img src={getProductImage(product.name)} alt={product.name}
                            style={{ width: "28px", height: "28px", borderRadius: "4px", objectFit: "cover" }} />
                        <span style={{ fontSize: "13px", color: "#374151" }}>
                          {product.name} — {product.quantity} {product.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {order.status !== 'delivered' && (
                      <button onClick={() => handleEditClick(order)} style={{
                        padding: "6px 16px", background: "#3b82f6", color: "#fff",
                        border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
                      }}>Editar</button>
                    )}
                    <button onClick={() => handleSaveAsFavorite(order)} style={{
                      padding: "6px 16px", background: "#f59e0b", color: "#fff",
                      border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
                    }}>⭐ Favorito</button>
                    {order.status !== 'in_progress' && order.status !== 'delivered' && (
                      <button onClick={() => handleRemoveOrder(order.id)} style={{
                        padding: "6px 16px", background: "#fee2e2", color: "#ef4444",
                        border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px"
                      }}>Eliminar</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Notification Modal */}
      {notification && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
          }}>
            {/* Icon based on type */}
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: "24px",
              backgroundColor: notification.type === 'success' ? '#dcfce7' : 
                               notification.type === 'info' ? '#dbeafe' : '#fef2f2',
              color: notification.type === 'success' ? '#166534' : 
                     notification.type === 'info' ? '#1d4ed8' : '#dc2626'
            }}>
              {notification.type === 'success' ? '✓' : 
               notification.type === 'info' ? 'ℹ' : '⚠'}
            </div>

            {/* Title */}
            <h3 style={{
              margin: "0 0 8px 0",
              fontSize: "18px",
              fontWeight: 600,
              color: "#374151",
              textAlign: "center"
            }}>
              {notification.title}
            </h3>

            {/* Message */}
            <p style={{
              margin: "0 0 20px 0",
              fontSize: "14px",
              color: "#6b7280",
              lineHeight: "1.5",
              textAlign: "center"
            }}>
              {notification.message}
            </p>

            {/* OK Button */}
            <button
              onClick={closeNotification}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: notification.type === 'success' ? '#22c55e' : 
                               notification.type === 'info' ? '#3b82f6' : '#ef4444',
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyOrders;
