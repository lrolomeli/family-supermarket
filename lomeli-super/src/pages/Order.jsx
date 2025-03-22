import React, { useState } from "react";
import { auth } from "../firebase";
import products from "../data/products";
import { Link } from "react-router-dom";
import API_BASE_URL from "../config";

const Order = () => {
  // producto seleccionado
  const [selectedProduct, setSelectedProduct] = useState(null);
  // cantidad del producto
  const [quantity, setQuantity] = useState(1);
  // unidades para el producto
  const [unit, setUnit] = useState("pieces"); // Default unit
  // carrito es una lista de items
  const [cart, setCart] = useState([]);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
  };

  const handleAddToCart = () => {
    if (!selectedProduct || quantity <= 0) return;
  
    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === selectedProduct.id);
  
      if (existingItem) {
        // Update quantity if item already exists
        return prevCart.map(item =>
          item.id === selectedProduct.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Add new item
        return [...prevCart, { id: selectedProduct.id, name: selectedProduct.name, quantity, unit }];
      }
    });
  
    setSelectedProduct(null);
    setQuantity(1);
    setUnit("pieces");
  };
  

  // para subir una orden
  const handleSubmitOrder = async () => {
    const user = auth.currentUser;
    // checar autenticacion
    if (!user) {
      alert("Please log in to place an order.");
      return;
    }

    // asociar el carrito con el usuario
    const order = {
      uid: user.uid,
      products: cart,
    };

    // hacer un post de la orden a la base de datos
    try {
      
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(order),
      });

      // esperamos para ver si la orden fue agregada exitosamente
      const result = await response.json();
      console.log("Order submitted:", result);
      alert("Order submitted successfully!");
      setCart([]); // Clear the cart

    } catch (error) {
      console.error("Error submitting order:", error);
      alert("Failed to submit order.");
    }
  };

  return (
    <div>
      <h2>Place Your Order</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => handleProductSelect(product)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px",
              borderRadius: "20px",
              border: "1px solid #ccc",
              background: "#f9f9f9",
              cursor: "pointer",
            }}
          >
            <img
              src={product.image}
              alt={product.name}
              style={{ width: "100px", height: "100px", borderRadius: "5px" }}
            />
          </button>
        ))}
      </div>

      {selectedProduct && (
        <div style={{ marginTop: "20px" }}>
          <h3>Selected Product: {selectedProduct.name}</h3>
          <label>
            Quantity:
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              min="1"
              style={{ marginLeft: "10px" }}
            />
          </label>
          <label style={{ marginLeft: "20px" }}>
            Unit:
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              style={{ marginLeft: "10px" }}
            >
              <option value="pieces">Pieces</option>
              <option value="kg">Kilograms (kg)</option>
            </select>
          </label>
          <button onClick={handleAddToCart} style={{ marginLeft: "20px" }}>
            Add to Cart
          </button>
        </div>
      )}

      {cart.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3>Your Cart</h3>
          <ul>
            {cart.map((item, index) => (
              <li key={index}>
                {item.name} - {item.quantity} {item.unit}
              </li>
            ))}
          </ul>
          <button onClick={handleSubmitOrder}>Submit Order</button>
        </div>
      )}

      <Link to="/my-orders">
        <button style={{ marginTop: "20px" }}>View My Orders</button>
      </Link>
    </div>
  );
};

export default Order;