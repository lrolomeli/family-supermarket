import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import API_BASE_URL from "../config";
import apiFetch from "../api";

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editedProducts, setEditedProducts] = useState([]);
  const user = auth.currentUser;

  const refreshOrders = async () => {
    const response = await apiFetch(`${API_BASE_URL}/orders`);
    const data = await response.json();
    setOrders(data);
  };

  useEffect(() => {
    if (!user) return;
    refreshOrders().catch((e) => console.error("Error fetching orders:", e));
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
      prev.map((p, i) => (i === index ? { ...p, [field]: field === "quantity" ? Number(value) : value } : p))
    );
  };

  const handleSaveEdit = async (orderId) => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify({ products: editedProducts }),
      });
      if (response.ok) {
        setEditingOrderId(null);
        await refreshOrders();
      }
    } catch (error) {
      console.error("Error updating order:", error);
    }
  };

  const handleDeleteProduct = async (orderId, productIndex) => {
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/orders/${orderId}/products/${productIndex}`,
        { method: "DELETE" }
      );
      if (response.ok) await refreshOrders();
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const handleRemoveOrder = async (id) => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/orders/${id}`, { method: "DELETE" });
      if (response.ok) await refreshOrders();
    } catch (error) {
      console.error("Error deleting order:", error);
    }
  };

  return (
    <div>
      <h2>My Orders</h2>
      {orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <ul>
          {orders.map((order) => (
            <li key={order.id}>
              <h3>Order ID: {order.id}</h3>
              {editingOrderId === order.id ? (
                <div>
                  <ul>
                    {editedProducts.map((product, index) => (
                      <li key={index}>
                        {product.name} —
                        <input
                          type="number"
                          min="1"
                          value={product.quantity}
                          onChange={(e) => handleProductChange(index, "quantity", e.target.value)}
                          style={{ width: "50px", margin: "0 6px" }}
                        />
                        <select
                          value={product.unit}
                          onChange={(e) => handleProductChange(index, "unit", e.target.value)}
                        >
                          <option value="pieces">Pieces</option>
                          <option value="kg">kg</option>
                        </select>
                        <button onClick={() => handleDeleteProduct(order.id, index)} style={{ marginLeft: "8px" }}>
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => handleSaveEdit(order.id)}>Save</button>
                  <button onClick={handleCancelEdit} style={{ marginLeft: "8px" }}>Cancel</button>
                </div>
              ) : (
                <div>
                  <ul>
                    {order.products.map((product, index) => (
                      <li key={index}>
                        {product.quantity} {product.unit} of {product.name}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => handleEditClick(order)}>Edit</button>
                  <button onClick={() => handleRemoveOrder(order.id)} style={{ marginLeft: "8px" }}>Remove</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyOrders;
