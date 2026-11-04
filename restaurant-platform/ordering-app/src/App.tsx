import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";

const LocationSelect = lazy(() => import("./pages/LocationSelect").then(m => ({ default: m.LocationSelect })));
const Menu = lazy(() => import("./pages/Menu").then(m => ({ default: m.Menu })));
const Checkout = lazy(() => import("./pages/Checkout").then(m => ({ default: m.Checkout })));
const Success = lazy(() => import("./pages/Success").then(m => ({ default: m.Success })));
const Cancel = lazy(() => import("./pages/Cancel").then(m => ({ default: m.Cancel })));

export default function App() {
  return (
    <CartProvider>
      <header className="border-b border-walnut/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="font-display text-xl font-semibold text-wine">Brasaland</a>
          <span className="text-xs uppercase tracking-widest text-walnut/40">Pedido online</span>
        </div>
      </header>
      <main>
        <Suspense fallback={<p className="p-6 text-center">Cargando página...</p>}>
          <Routes>
            <Route path="/" element={<LocationSelect />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/success" element={<Success />} />
            <Route path="/cancel" element={<Cancel />} />
          </Routes>
        </Suspense>
      </main>
    </CartProvider>
  );
}
