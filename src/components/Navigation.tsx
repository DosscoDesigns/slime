"use client";

import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { useCart } from "./CartProvider";

const navLinks = [
  { name: "Products", href: "#products" },
  { name: "How It Works", href: "#how-it-works" },
  { name: "About", href: "#about" },
  { name: "FAQ", href: "#faq" },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();
  const { totalItems, setIsOpen } = useCart();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 50);
  });

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 ${
        scrolled ? "bg-black/90 backdrop-blur-md shadow-lg shadow-lime/5" : "bg-transparent"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <motion.a
          href="#"
          className="text-2xl font-bold tracking-tight"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-lime">THE SLIME</span>{" "}
          <span className="text-white">CO</span>
        </motion.a>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <motion.a
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-gray-300 hover:text-lime transition-colors relative"
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {link.name}
            </motion.a>
          ))}
          <motion.a
            href="#products"
            className="bg-lime text-black px-6 py-2.5 rounded-full text-sm font-bold hover:bg-lime-dark transition-colors"
            whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(163, 230, 53, 0.4)" }}
            whileTap={{ scale: 0.95 }}
          >
            Shop Now
          </motion.a>

          {/* Cart button */}
          <motion.button
            className="relative text-gray-300 hover:text-lime transition-colors p-1"
            onClick={() => setIsOpen(true)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Open cart"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
            </svg>
            {totalItems > 0 && (
              <motion.span
                className="absolute -top-1.5 -right-1.5 bg-lime text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                key={`desktop-${totalItems}`}
              >
                {totalItems}
              </motion.span>
            )}
          </motion.button>
        </div>

        {/* Mobile: cart + hamburger */}
        <div className="flex md:hidden items-center gap-3">
          <motion.button
            className="relative text-gray-300 hover:text-lime transition-colors p-1"
            onClick={() => setIsOpen(true)}
            whileTap={{ scale: 0.9 }}
            aria-label="Open cart"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
            </svg>
            {totalItems > 0 && (
              <motion.span
                className="absolute -top-1.5 -right-1.5 bg-lime text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                key={`mobile-${totalItems}`}
              >
                {totalItems}
              </motion.span>
            )}
          </motion.button>
          <button
            className="text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <motion.div
              className="w-6 h-5 flex flex-col justify-between"
              animate={mobileOpen ? "open" : "closed"}
            >
              <motion.span
                className="block h-0.5 bg-white origin-left"
                variants={{
                  open: { rotate: 45, y: 0 },
                  closed: { rotate: 0, y: 0 },
                }}
              />
              <motion.span
                className="block h-0.5 bg-white"
                variants={{
                  open: { opacity: 0, x: -20 },
                  closed: { opacity: 1, x: 0 },
                }}
              />
              <motion.span
                className="block h-0.5 bg-white origin-left"
                variants={{
                  open: { rotate: -45, y: 0 },
                  closed: { rotate: 0, y: 0 },
                }}
              />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <motion.div
        className="md:hidden overflow-hidden"
        initial={false}
        animate={{ height: mobileOpen ? "auto" : 0, opacity: mobileOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bg-black/95 backdrop-blur-md px-6 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-gray-300 hover:text-lime transition-colors py-2"
              onClick={() => setMobileOpen(false)}
            >
              {link.name}
            </a>
          ))}
          <a
            href="#products"
            className="bg-lime text-black px-6 py-2.5 rounded-full text-sm font-bold text-center"
            onClick={() => setMobileOpen(false)}
          >
            Shop Now
          </a>
        </div>
      </motion.div>
    </motion.nav>
  );
}
