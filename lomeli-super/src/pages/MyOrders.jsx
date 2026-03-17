import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import API_BASE_URL from "../config";
import apiFetch from "../api";

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
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

  const handleEditClick = (orderId) => setEditingOrderId(orderId);

  const handleDeleteClick = async (orderId, productIndex) => {
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/orders/${orderId}/products/${productIndex}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        alert("Item deleted");
        await refreshOrders();
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const handleRemoveClick = async (id) => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/orders/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        alert("Order deleted");
        await refreshOrders();
      }
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
              <ul>
                {order.products.map((product, index) => (
                  <li key={index}>
                    {product.quantity} {product.unit} of {product.name}
                    {editingOrderId === order.id && (
                      <button onClick={() => handleDeleteClick(order.id, index)}>
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button onClick={() => handleEditClick(order.id)}>Edit</button>
              <button onClick={() => handleRemoveClick(order.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyOrders;
