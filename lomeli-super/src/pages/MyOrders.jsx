import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import API_BASE_URL from "../config";

const MyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null); // Track which order is being edited
  const user = auth.currentUser;

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;

      try {
        const response = await fetch(`${API_BASE_URL}/orders?uid=${user.uid}`);
        const data = await response.json();
        setOrders(data);
      } catch (error) {
        console.error("Error fetching orders:", error);
      }
    };

    fetchOrders();
  }, [user]);

  const handleEditClick = (orderId) => {
    setEditingOrderId(orderId); // Set the order ID being edited
  };

  const handleDeleteClick = async (orderId, productIndex) => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/products/${productIndex}`, {method: 'DELETE'});
      
      if (response.ok) {
        alert('Item deleted');
        const response = await fetch(`${API_BASE_URL}/orders?uid=${user.uid}`);
        const data = await response.json();
        setOrders(data);
      }
  
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleRemoveClick = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/${id}`, {method: 'DELETE'});
      
      if (response.ok) {
        alert('Order deleted');
        const response = await fetch(`${API_BASE_URL}/orders?uid=${user.uid}`);
        const data = await response.json();
        setOrders(data);
      }
  
    } catch (error) {
      console.error('Error deleting product:', error);
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
                    {editingOrderId === order.id && ( // Show delete button if this order is being edited
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