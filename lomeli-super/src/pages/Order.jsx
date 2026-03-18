import { useState, useEffect } from "react";
import { auth } from "../firebase";
import API_BASE_URL from "../config";
import apiFetch from "../api";

// Bottom sheet para seleccionar cantidad y unidad
const ProductSheet = ({ product, onAdd, onClose }) => {
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("pieces");

  const handleAdd = () => {
    onAdd(product, quantity, unit);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100,
      }} />
      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
        background: "#fff", borderRadius: "20px 20px 0 0",
        padding: "24px 20px 36px",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
        animation: "slideUp 0.2s ease",
      }}>
        {/* Handle */}
        <div style={{ width: "40px", height: "4px", background: "#e5e7eb", borderRadius: "2px", margin: "0 auto 20px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <img src={product.image || '/assets/default-product.svg'} alt={product.name}
            style={{ width: "64px", height: "64px", borderRadius: "12px", objectFit: "cover" }} />
          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#15803d" }}>{product.name}</h3>
        </div>

        {/* Unidad */}
        <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#6b7280", fontWeight: 600 }}>UNIDAD</p>
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          {["pieces", "kg"].map(u => (
            <button key={u} onClick={() => setUnit(u)} style={{
              flex: 1, padding: "12px", borderRadius: "10px", border: "2px solid",
              borderColor: unit === u ? "#15803d" : "#e5e7eb",
              background: unit === u ? "#f0fdf4" : "#fff",
              color: unit === u ? "#15803d" : "#6b7280",
              fontWeight: 600, fontSize: "15px", cursor: "pointer",
            }}>
              {u === "pieces" ? "🧺 Piezas" : "⚖️ Kilos"}
            </button>
          ))}
        </div>

        {/* Cantidad */}
        <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#6b7280", fontWeight: 600 }}>CANTIDAD</p>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{
            width: "48px", height: "48px", borderRadius: "50%", border: "2px solid #e5e7eb",
            background: "#fff", fontSize: "22px", cursor: "pointer", color: "#374151",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>−</button>
          <span style={{ fontSize: "28px", fontWeight: 700, color: "#111827", minWidth: "40px", textAlign: "center" }}>
            {quantity}
          </span>
          <button onClick={() => setQuantity(q => q + 1)} style={{
            width: "48px", height: "48px", borderRadius: "50%", border: "none",
            background: "#15803d", fontSize: "22px", cursor: "pointer", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>+</button>
        </div>

        <button onClick={handleAdd} style={{
          width: "100%", padding: "16px", background: "#15803d", color: "#fff",
          border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: 700,
          cursor: "pointer",
        }}>
          Agregar al carrito
        </button>
      </div>
    </>
  );
};

const Order = () => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/products`)
      .then(r => r.json())
      .then(data => setProducts(data))
      .catch(console.error);
  }, []);

  const handleAddToCart = (product, quantity, unit) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id && i.unit === unit);
      if (existing) {
        return prev.map(i =>
          i.id === product.id && i.unit === unit
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { id: product.id, name: product.name, quantity, unit }];
    });
  };

  const handleSubmitOrder = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setSubmitting(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        body: JSON.stringify({ products: cart }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server error ${response.status}: ${errText}`);
      }
      setCart([]);
      setShowCart(false);
      alert("¡Orden enviada!");
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const totalItems = cart.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px 12px 100px" }}>
      <h2 style={{ margin: "0 0 16px", fontSize: "22px", fontWeight: 800, color: "#15803d" }}>
        Nueva Orden
      </h2>

      {/* Grid de productos */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
        gap: "12px",
      }}>
        {products.map(product => {
          const inCart = cart.find(i => i.id === product.id);
          return (
            <button key={product.id} onClick={() => setSelectedProduct(product)} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "10px 6px", borderRadius: "14px",
              border: inCart ? "2px solid #15803d" : "2px solid #f3f4f6",
              background: inCart ? "#f0fdf4" : "#fff",
              cursor: "pointer", position: "relative",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              transition: "border-color 0.15s",
            }}>
              {inCart && (
                <span style={{
                  position: "absolute", top: "6px", right: "6px",
                  background: "#15803d", color: "#fff", borderRadius: "999px",
                  fontSize: "11px", fontWeight: 700, padding: "1px 6px",
                }}>
                  {cart.filter(i => i.id === product.id).reduce((a, i) => a + i.quantity, 0)}
                </span>
              )}
              <img src={product.image || '/assets/default-product.svg'} alt={product.name}
                style={{ width: "64px", height: "64px", objectFit: "cover", borderRadius: "10px" }} />
              <span style={{
                marginTop: "6px", fontSize: "12px", fontWeight: 600,
                color: "#374151", textAlign: "center", lineHeight: 1.3,
              }}>
                {product.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Botón flotante del carrito */}
      {cart.length > 0 && (
        <button onClick={() => setShowCart(true)} style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          background: "#15803d", color: "#fff", border: "none", borderRadius: "999px",
          padding: "14px 28px", fontSize: "15px", fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(21,128,61,0.4)", zIndex: 50,
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          🛒 Ver carrito
          <span style={{
            background: "#fff", color: "#15803d", borderRadius: "999px",
            padding: "2px 8px", fontSize: "13px", fontWeight: 800,
          }}>{totalItems}</span>
        </button>
      )}

      {/* Bottom sheet producto */}
      {selectedProduct && (
        <ProductSheet
          product={selectedProduct}
          onAdd={handleAddToCart}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* Bottom sheet carrito */}
      {showCart && (
        <>
          <div onClick={() => setShowCart(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100,
          }} />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
            background: "#fff", borderRadius: "20px 20px 0 0",
            padding: "24px 20px 36px", maxHeight: "75vh", overflowY: "auto",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
          }}>
            <div style={{ width: "40px", height: "4px", background: "#e5e7eb", borderRadius: "2px", margin: "0 auto 20px" }} />
            <h3 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: 700 }}>Tu carrito</h3>
            {cart.map((item, index) => (
              <div key={index} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 0", borderBottom: "1px solid #f3f4f6",
              }}>
                <span style={{ fontSize: "15px", color: "#374151" }}>
                  {item.name}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "14px", color: "#6b7280" }}>
                    {item.quantity} {item.unit === "kg" ? "kg" : "pzs"}
                  </span>
                  <button onClick={() => setCart(prev => prev.filter((_, i) => i !== index))}
                    style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "18px" }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button onClick={handleSubmitOrder} disabled={submitting} style={{
              width: "100%", marginTop: "20px", padding: "16px",
              background: submitting ? "#86efac" : "#15803d", color: "#fff",
              border: "none", borderRadius: "12px", fontSize: "16px",
              fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer",
            }}>
              {submitting ? "Enviando..." : "Confirmar orden"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Order;
