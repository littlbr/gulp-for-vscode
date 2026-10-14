// Boutique Nova: cart (demo project)
export function addToCart(cart, product) {
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    return [...cart, product];
}
