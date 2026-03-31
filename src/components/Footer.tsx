"use client";

import { motion } from "framer-motion";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <motion.div
              className="text-2xl font-bold tracking-tight mb-4"
              whileHover={{ scale: 1.02 }}
            >
              <span className="text-lime">THE SLIME</span>{" "}
              <span className="text-white">CO</span>
            </motion.div>
            <p className="text-gray-500 max-w-sm">
              Premium slime powder kits that turn any event into an unforgettable
              experience. Just add water.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-bold mb-4">Shop</h4>
            <ul className="space-y-2">
              {["Slime Only", "Starter Kit", "Youth Group Kit", "Accessories"].map(
                (item) => (
                  <li key={item}>
                    <a
                      href="#products"
                      className="text-gray-500 hover:text-lime transition-colors text-sm"
                    >
                      {item}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4">Company</h4>
            <ul className="space-y-2">
              {["About", "FAQ", "Contact", "Shipping & Returns"].map(
                (item) => (
                  <li key={item}>
                    <a
                      href="#about"
                      className="text-gray-500 hover:text-lime transition-colors text-sm"
                    >
                      {item}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} The Slime Co. All rights reserved.
          </p>
          <div className="flex gap-6">
            {["Privacy", "Terms"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-gray-600 hover:text-gray-400 transition-colors text-sm"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
