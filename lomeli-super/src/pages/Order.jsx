import { useState, useEffect, useRef } from "react";
import API_BASE_URL from "../config";
import apiFetch from "../api";

// Bottom sheet para seleccionar cantidad y unidad
const ProductSheet = ({ product, onAdd, onClose }) => {
  const sellBy = product.sell_by || "both";
  const defaultUnit = sellBy === "kg" ? "kg" : "pieces";
  const [quantity, setQuantity] = useState(defaultUnit === "kg" ? 0.5 : 1);
  const [unit, setUnit] = useState(defaultUnit);
  const unitOptions = sellBy === "both" ? ["pieces", "kg"] : [sellBy];

  const handleAdd = () => {
    onAdd(product, quantity, unit);
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100,
      }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101,
        background: "#fff", borderRadius: "20px 20px 0 0",
        padding: "24px 20px calc(36px + env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
      }}>
        <div style={{ width: "40px", height: "4px", background: "#e5e7eb", borderRadius: "2px", margin: "0 auto 20px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <img src={product.image || '/assets/default-product.svg'} alt={product.name}
            style={{ width: "64px", height: "64px", borderRadius: "12px", objectFit: "cover" }} />
          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#15803d" }}>{product.name}</h3>
        </div>

        {unitOptions.length > 1 && (
          <>
            <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#6b7280", fontWeight: 600 }}>UNIDAD</p>
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              {unitOptions.map(u => (
                <button key={u} onClick={() => { setUnit(u); setQuantity(u === "kg" ? 0.5 : 1); }} style={{
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
          </>
        )}
        {unitOptions.length === 1 && (
          <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#6b7280" }}>
            Se vende por {unit === "pieces" ? "piezas" : "kilo"}
          </p>
        )}

        <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#6b7280", fontWeight: 600 }}>CANTIDAD</p>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <button onClick={() => { const step = unit === "kg" ? 0.5 : 1; const min = unit === "kg" ? 0.5 : 1; setQuantity(q => Math.max(min, +(q - step).toFixed(1))); }} style={{
            width: "48px", height: "48px", borderRadius: "50%", border: "2px solid #e5e7eb",
            background: "#fff", fontSize: "22px", cursor: "pointer", color: "#374151",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>−</button>
          <span style={{ fontSize: "28px", fontWeight: 700, color: "#111827", minWidth: "50px", textAlign: "center" }}>
            {quantity}{unit === "kg" ? " kg" : ""}
          </span>
          <button onClick={() => { const step = unit === "kg" ? 0.5 : 1; setQuantity(q => +(q + step).toFixed(1)); }} style={{
            width: "48px", height: "48px", borderRadius: "50%", border: "none",
            background: "#15803d", fontSize: "22px", cursor: "pointer", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>+</button>
        </div>

        <button onClick={handleAdd} style={{
          width: "100%", padding: "16px", background: "#15803d", color: "#fff",
          border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: 700,
          cursor: "pointer", WebkitTapHighlightColor: "transparent",
        }}>
          Agregar al carrito
        </button>
      </div>
    </>
  );
};

// Normaliza texto para búsqueda (sin acentos, minúsculas)
const normalize = (str) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const Order = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [note, setNote] = useState("");
  const [focused, setFocused] = useState(false);
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    apiFetch(`${API_BASE_URL}/products`)
      .then(r => r.json())
      .then(setProducts)
      .catch(e => console.error("Error loading products:", e));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (
        searchRef.current && !searchRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = search.trim()
    ? products.filter(p => normalize(p.name).includes(normalize(search)))
    : [];

  const handleAddToCart = (product, quantity, unit) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id && i.unit === unit);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + quantity };
        return updated;
      }
      return [...prev, { product, quantity, unit }];
    });
    setSearch("");
    setFocused(false);
  };

  const handleRemoveFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const products = cart.map(i => ({
        product_id: i.product.id,
        name: i.product.name,
        quantity: i.quantity,
        unit: i.unit,
        image: i.product.image || null,
      }));
      const res = await apiFetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        body: JSON.stringify({ products, note }),
      });
      if (!res.ok) throw new Error("Error al enviar orden");
      setCart([]);
      setNote("");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (e) {
      console.error("Submit order error:", e);
      alert("Error al enviar la orden. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.quantity, 0);

  if (submitted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "20px", textAlign: "center" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>✅</div>
        <h2 style={{ color: "#15803d", margin: "0 0 8px" }}>Orden enviada</h2>
        <p style={{ color: "#6b7280" }}>Tu pedido ha sido recibido.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", maxWidth: "600px", margin: "0 auto", paddingBottom: "100px" }}>
      <h2 style={{ margin: "0 0 16px", color: "#15803d", fontSize: "22px" }}>Nuevo Pedido</h2>

      {/* Search input */}
      <div style={{ position: "relative" }}>
        <input
          ref={searchRef}
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={e => { setSearch(e.target.value); setFocused(true); }}
          onFocus={() => setFocused(true)}
          style={{
            width: "100%", padding: "14px 16px", fontSize: "16px",
            border: "2px solid #d1d5db", borderRadius: "12px",
            outline: "none", boxSizing: "border-box",
            WebkitAppearance: "none",
          }}
        />

        {/* Dropdown results */}
        {focused && filtered.length > 0 && (
          <div ref={dropdownRef} style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
            marginTop: "4px", maxHeight: "300px", overflowY: "auto",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          }}>
            {filtered.map(p => (
              <div
                key={p.id}
                onClick={() => { setSelectedProduct(p); setFocused(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 16px", cursor: "pointer",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <img
                  src={p.image || "/assets/default-product.svg"}
                  alt={p.name}
                  style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover" }}
                />
                <span style={{ fontSize: "15px", color: "#111827" }}>{p.name}</span>
              </div>
            ))}
          </div>
        )}

        {focused && search.trim() && filtered.length === 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
            marginTop: "4px", padding: "16px", textAlign: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)", color: "#6b7280",
          }}>
            No se encontraron productos
          </div>
        )}
      </div>

      {/* Cart items preview */}
      {cart.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#6b7280", fontWeight: 600 }}>
            EN TU CARRITO ({cartTotal} {cartTotal === 1 ? "artículo" : "artículos"})
          </p>
          {cart.map((item, idx) => (
            <div key={idx} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "10px 0", borderBottom: "1px solid #f3f4f6",
            }}>
              <img
                src={item.product.image || "/assets/default-product.svg"}
                alt={item.product.name}
                style={{ width: "36px", height: "36px", borderRadius: "8px", objectFit: "cover" }}
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: "14px", color: "#111827" }}>{item.product.name}</span>
                <span style={{ fontSize: "13px", color: "#6b7280", marginLeft: "8px" }}>
                  {item.quantity} {item.unit === "pieces" ? "pz" : "kg"}
                </span>
              </div>
              <button onClick={() => handleRemoveFromCart(idx)} style={{
                background: "none", border: "none", color: "#ef4444",
                fontSize: "18px", cursor: "pointer", padding: "4px 8px",
              }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Note */}
      {cart.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <textarea
            placeholder="Nota para tu pedido (opcional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            style={{
              width: "100%", padding: "12px", fontSize: "14px",
              border: "1px solid #d1d5db", borderRadius: "10px",
              resize: "none", boxSizing: "border-box", outline: "none",
            }}
          />
        </div>
      )}

      {/* Floating submit button */}
      {cart.length > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 90,
          padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
          background: "#fff", borderTop: "1px solid #e5e7eb",
        }}>
          <button
            onClick={handleSubmitOrder}
            disabled={submitting}
            style={{
              width: "100%", padding: "16px", background: submitting ? "#86efac" : "#15803d",
              color: "#fff", border: "none", borderRadius: "12px",
              fontSize: "16px", fontWeight: 700, cursor: submitting ? "default" : "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {submitting ? "Enviando..." : `Confirmar Orden (${cartTotal})`}
          </button>
        </div>
      )}

      {/* ProductSheet */}
      {selectedProduct && (
        <ProductSheet
          product={selectedProduct}
          onAdd={handleAddToCart}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
};

export default Order;
