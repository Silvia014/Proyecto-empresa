import { Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import { LocationSelect } from "./pages/LocationSelect";
import { Menu } from "./pages/Menu";
import { Checkout } from "./pages/Checkout";
import { Success } from "./pages/Success";
import { Cancel } from "./pages/Cancel";

export default function App() {
  return (
    <CartProvider>
      <header className="border-b border-walnut/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="font-display text-xl font-semibold text-wine">
            Brasaland
          </a>
          <span className="text-xs uppercase tracking-widest text-walnut/40">Pedido online</span>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<LocationSelect />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/success" element={<Success />} />
          <Route path="/cancel" element={<Cancel />} />
        </Routes>
      </main>
    </CartProvider>
  );
}
