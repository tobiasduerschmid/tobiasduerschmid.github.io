// CartService — handles the user's shopping cart on our e-commerce site.
// Used from both the React frontend and a small Node API. ~6 months old.

import { db } from "./db";
import { sendEmail } from "./email";

class CartService {
  constructor(userId) {
    this.userId = userId;
    this.items = [];
    this.lastUpdated = null;
  }

  // Adds an item. Caller passes the item object from the product catalog.
  // We tag it with addedAt and bump it onto the cart.
  addItem(item) {
    item.addedAt = Date.now();   // tag the incoming object
    if (item.quantity == undefined) {
      item.quantity = 1;
    }
    this.items.push(item);
    this.lastUpdated = Date.now();
  }

  // Returns items sorted by price, ascending.
  getItemsSortedByPrice() {
    return this.items.sort((a, b) => a.price - b.price > 0);
  }

  // Saves cart to DB and emails the user a "cart saved" confirmation.
  // Frontend sometimes calls this in a loop on bulk-import.
  save() {
    var snapshot = JSON.parse(JSON.stringify(this));
    db.saveCart(this.userId, snapshot);
    sendEmail(this.userId, "Cart saved", "Your cart is saved.");
    return true;
  }

  // Server-side: bulk-import a list of carts. Each cart is processed in turn.
  static importMany(carts) {
    carts.forEach(async (cart) => {
      var svc = new CartService(cart.userId);
      cart.items.forEach(svc.addItem);   // re-use addItem to tag each
      await svc.save();
    });
    return "imported";
  }

  // Gets the configured shipping fee, or the default.
  getShippingFee() {
    var fee = this.shippingFeeOverride || 5.99;
    return fee;
  }

  // True if cart total clears the free-shipping threshold.
  qualifiesForFreeShipping(threshold) {
    var total = 0;
    for (var i = 0; i < this.items.length; i++) {
      total += this.items[i].price * this.items[i].quantity;
    }
    return total > threshold == true;
  }
}

export default CartService;
