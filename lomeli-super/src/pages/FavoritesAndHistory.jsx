import { useEffect, useState } from "react";
import { auth } from "../firebase";
import API_BASE_URL from "../config";
import apiFetch from "../api";
import { calcOrderTotal, formatMXN } from "../utils/pricing";

const STATUS_MAP = {
  pending:     { bg: "#fffbeb", color: "#d97706", label: "Pendiente", icon: "🕐" },
  in_progress: { bg: "#eff6ff", color: "#2563eb", label: "En Progreso", icon: "📦" },
  delivered:   { bg: "#f0fdf4", color: "#16a34a", label: "Entregado", icon: "✅" },
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

const FavoritesAndHistory = () => {
  const [activeTab, setActiveTab] = useState('favorites');
  const [favorites, setFavorites] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [productCatalog, setProductCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notification, setNotification] = useState(null);

  const firebaseUser = auth.currentUser;
  const localUser = !firebaseUser ? JSON.parse(localStorage.getItem("local_user") || "null") : null;
  const isAuthenticated = !!firebaseUser || !!localUser;

  const showNotification = (title, message, type = 'success') => {
    setNotification({ title, message, type });
  };

  useEffect(() => {
    apiFetch(`${API_BASE_URL}/products`)
      .then(r => r.json())
      .then(data => setProductCatalog(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setFavorites([]);
    setOrderHistory([]);
    loadData().catch(console.error);
  }, [isAuthenticated, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    if (activeTab === 'favorites') setFavorites([]);
    else setOrderHistory([]);
    try {
      if (activeTab === 'favorites') {
        const response = await apiFetch(`${API_BASE_URL}/favorites?t=${Date.now()}`);
        setFavorites(await response.json());
      } else {
        const response = await apiFetch(`${API_BASE_URL}/orders/history?t=${Date.now()}`);
        setOrderHistory(await response.json());
      }
    } catch (err) {
      setError("Error al cargar datos");
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
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
        showNotification("Favorito Guardado", `Pedido guardado como "${name.trim()}".`, 'success');
        const refreshRes = await apiFetch(`${API_BASE_URL}/favorites?t=${Date.now()}`);
        setFavorites(await refreshRes.json());
      } else {
        const errText = await response.text();
        setError(errText || "No se pudo guardar el favorito");
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error saving favorite:", err);
    }
  };

  const handleReorder = async (order, isHistory = false) => {
    try {
      let response;
      if (isHistory) {
        response = await apiFetch(`${API_BASE_URL}/orders`, {
          method: "POST",
          body: JSON.stringify({ products: order.products }),
        });
      } else {
        response = await apiFetch(`${API_BASE_URL}/favorites/${order.id}/reorder`, {
          method: "POST",
        });
      }
      if (response.ok) {
        const newOrder = await response.json();
        showNotification("Pedido Creado", `Nuevo pedido #${newOrder.id} creado.`, 'success');
      } else {
        const errText = await response.text();
        setError(errText || "No se pudo crear el pedido");
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error reordering:", err);
    }
  };

  const handleDeleteFavorite = async (favoriteId) => {
    if (!confirm("¿Eliminar este pedido de favoritos?")) return;
    try {
      const response = await apiFetch(`${API_BASE_URL}/favorites/${favoriteId}`, { method: "DELETE" });
      if (response.ok) {
        setFavorites(prev => prev.filter(fav => fav.id !== favoriteId));
        setSuccess("Favorito eliminado");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errText = await response.text();
        setError(errText || "No se pudo eliminar el favorito");
      }
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
      console.error("Error deleting favorite:", err);
    }
  };

  const getProductImage = (name) => {
    const found = productCatalog.find(p => p.name === name);
    const img = found?.image;
    return img ? `${API_BASE_URL}${img}` : '/assets/default-product.svg';
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
          Favoritos e Historial
        </h2>
        <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
          Repite pedidos rápidamente
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: "6px", marginBottom: "16px",
        background: "#f3f4f6", borderRadius: "12px", padding: "4px",
      }}>
        {[
          { key: "favorites", label: "⭐ Favoritos" },
          { key: "history", label: "📜 Historial" },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            flex: 1, padding: "10px 0", border: "none", borderRadius: "10px",
            fontSize: "14px", fontWeight: 600, cursor: "pointer",
            background: activeTab === t.key ? "#fff" : "transparent",
            color: activeTab === t.key ? "#111827" : "#9ca3af",
            boxShadow: activeTab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            WebkitTapHighlightColor: "transparent",
            transition: "all .15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Error / Success */}
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

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af", fontSize: "14px" }}>
          Cargando...
        </div>
      )}

      {/* Favorites Tab */}
      {activeTab === 'favorites' && !loading && (
        favorites.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#d1d5db" }}>
            <div style={{ fontSize: "48px", marginBottom: "8px" }}>⭐</div>
            <p style={{ margin: "0 0 4px", fontSize: "14px", color: "#9ca3af" }}>No tienes favoritos</p>
            <p style={{ margin: 0, fontSize: "12px", color: "#d1d5db" }}>Guarda pedidos frecuentes para repetirlos rápido</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {favorites.map(fav => {
              const total = productCatalog.length > 0 ? calcOrderTotal(fav.products, productCatalog) : null;
              return (
                <div key={fav.id} style={{
                  borderRadius: "14px", background: "#fff", overflow: "hidden",
                  border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}>
                  {/* Fav header */}
                  <div style={{
                    padding: "12px 14px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>
                        ⭐ {fav.name || "Sin nombre"}
                      </div>
                      {fav.created_at && (
                        <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                          Guardado {formatDate(fav.created_at)}
                        </div>
                      )}
                    </div>
                    {total !== null && (
                      <span style={{ fontWeight: 700, color: "#15803d", fontSize: "14px" }}>
                        {formatMXN(total)}
                      </span>
                    )}
                  </div>

                  {/* Products */}
                  <div style={{ padding: "10px 14px" }}>
                    {fav.products.map((product, idx) => (
                      <div key={idx} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "6px 0",
                        borderBottom: idx < fav.products.length - 1 ? "1px solid #f3f4f6" : "none",
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

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                      <ActionBtn onClick={() => handleReorder(fav, false)} bg="#f0fdf4" color="#15803d">
                        🛒 Pedir de nuevo
                      </ActionBtn>
                      <ActionBtn onClick={() => handleDeleteFavorite(fav.id)} bg="#fef2f2" color="#dc2626">
                        🗑️
                      </ActionBtn>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* History Tab */}
      {activeTab === 'history' && !loading && (
        orderHistory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#d1d5db" }}>
            <div style={{ fontSize: "48px", marginBottom: "8px" }}>📜</div>
            <p style={{ margin: 0, fontSize: "14px", color: "#9ca3af" }}>No tienes historial de pedidos</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {orderHistory.map(order => {
              const total = productCatalog.length > 0 ? calcOrderTotal(order.products, productCatalog) : null;
              const s = STATUS_MAP[order.status] || STATUS_MAP.pending;
              return (
                <div key={order.id} style={{
                  borderRadius: "14px", background: "#fff", overflow: "hidden",
                  border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}>
                  {/* Order header */}
                  <div style={{
                    padding: "12px 14px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>
                        Pedido #{order.id}
                      </div>
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                        {formatDate(order.created_at)}
                        {order.delivered_at && ` · Entregado ${formatDate(order.delivered_at)}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {total !== null && (
                        <span style={{ fontWeight: 700, color: "#15803d", fontSize: "14px" }}>
                          {formatMXN(total)}
                        </span>
                      )}
                      <span style={{
                        background: s.bg, color: s.color,
                        padding: "4px 10px", borderRadius: "999px",
                        fontSize: "11px", fontWeight: 700,
                        display: "inline-flex", alignItems: "center", gap: "4px",
                      }}>
                        {s.icon} {s.label}
                      </span>
                    </div>
                  </div>

                  {/* Products */}
                  <div style={{ padding: "10px 14px" }}>
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

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                      <ActionBtn onClick={() => handleReorder(order, true)} bg="#f0fdf4" color="#15803d">
                        🛒 Pedir de nuevo
                      </ActionBtn>
                      <ActionBtn onClick={() => handleSaveAsFavorite(order)} bg="#fffbeb" color="#d97706">
                        ⭐ Favorito
                      </ActionBtn>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
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

export default FavoritesAndHistory;
