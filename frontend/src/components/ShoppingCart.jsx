import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser, SignInButton } from "@clerk/clerk-react";

function ShoppingCart() {
  const { isSignedIn, user } = useUser();
  const cart = useQuery(api.cart.getCart);
  const addItem = useMutation(api.cart.addItem);
  const removeItem = useMutation(api.cart.removeItem);
  const clearCart = useMutation(api.cart.clearCart);

  const handleAddToCart = async (product) => {
    if (!isSignedIn) {
      alert("Please sign in to add items to cart");
      return;
    }

    await addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
    });
  };

  const handleRemoveItem = async (productId) => {
    await removeItem({ productId });
  };

  const handleClearCart = async () => {
    await clearCart();
  };

  if (!isSignedIn) {
    return (
      <div>
        <h2>Shopping Cart</h2>
        <p>Please sign in to view your cart</p>
        <SignInButton mode="modal">
          <button>Sign In</button>
        </SignInButton>
      </div>
    );
  }

  const cartItems = cart?.items || [];
  const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div>
      <h2>Shopping Cart</h2>
      <p>Hello, {user.firstName}!</p>
      
      {cartItems.length === 0 ? (
        <p>Your cart is empty</p>
      ) : (
        <>
          {cartItems.map((item) => (
            <div key={item.productId} style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0' }}>
              <h3>{item.name}</h3>
              <p>Price: ${item.price}</p>
              <p>Quantity: {item.quantity}</p>
              <p>Subtotal: ${(item.price * item.quantity).toFixed(2)}</p>
              <button onClick={() => handleRemoveItem(item.productId)}>Remove</button>
            </div>
          ))}
          
          <h3>Total: ${total.toFixed(2)}</h3>
          <button onClick={handleClearCart}>Clear Cart</button>
        </>
      )}

      {/* Example: Add product button */}
      <div style={{ marginTop: '20px' }}>
        <h3>Example Product</h3>
        <button onClick={() => handleAddToCart({
          id: 'prod-1',
          name: 'Sample Product',
          price: 29.99,
          image: 'https://example.com/image.jpg'
        })}>
          Add Sample Product to Cart
        </button>
      </div>
    </div>
  );
}

export default ShoppingCart;