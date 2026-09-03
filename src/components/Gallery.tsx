"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { GALLERY_PHOTOS } from "@/lib/photos";

export default function Gallery() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="gallery" className="py-32 px-6 relative" ref={ref}>
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 50 }}
        >
          <span className="text-lime text-sm font-bold tracking-widest uppercase">
            Gallery
          </span>
          <h2 className="text-4xl sm:text-6xl font-black mt-4 mb-6">
            Send Us Your{" "}
            <span className="text-lime">Pics!</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            Slimed your group? Tag us and we&apos;ll put the best shots up here.
          </p>
        </motion.div>

        {/* Masonry via CSS columns — the set is a mix of portrait and
            landscape, and columns keep the varied aspect ratios intact
            instead of cropping everything to a uniform tile. */}
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 [column-fill:_balance] max-w-5xl mx-auto">
          {GALLERY_PHOTOS.map((photo, i) => (
            <motion.figure
              key={photo.slug}
              className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/10 relative group"
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                // Stagger tapers off so the tail of a 21-tile grid doesn't
                // sit there waiting three seconds to appear.
                delay: Math.min(i * 0.05, 0.6),
                type: "spring",
                stiffness: 50,
              }}
            >
              <motion.img
                src={`/photos/${photo.slug}-620.webp`}
                width={photo.w}
                height={photo.h}
                alt={photo.alt}
                loading="lazy"
                decoding="async"
                className="w-full h-auto block"
                whileHover={{ scale: 1.04 }}
                transition={{ duration: 0.4 }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
