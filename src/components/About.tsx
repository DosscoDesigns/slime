"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const highlights = [
  {
    title: "Youth Groups",
    description: "The ultimate activity for lock-ins, VBS, summer camp, and retreats.",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=500&h=350&fit=crop",
  },
  {
    title: "Events & Parties",
    description: "Birthday parties, field days, fundraisers — slime makes everything better.",
    image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=500&h=350&fit=crop",
  },
  {
    title: "Content Creators",
    description: "YouTube, TikTok, Instagram — slime makes for incredible content.",
    image: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=500&h=350&fit=crop",
  },
];

export default function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="about" className="py-32 px-6" ref={ref}>
      <div className="max-w-7xl mx-auto">
        {/* Top section - Who we are */}
        <div className="grid md:grid-cols-2 gap-16 items-center mb-32">
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ type: "spring", stiffness: 50 }}
          >
            <span className="text-lime text-sm font-bold tracking-widest uppercase">
              About Us
            </span>
            <h2 className="text-4xl sm:text-5xl font-black mt-4 mb-6">
              Built for <span className="text-lime">the big moments</span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-6">
              We wanted to slime our youth group leaders — dump buckets over
              their heads, blast them with sprayers, the whole show. But
              nobody sold anything that could do that without spending a
              fortune or mixing sketchy ingredients in a garage.
            </p>
            <p className="text-gray-400 text-lg leading-relaxed">
              So we made our own.{" "}
              <span className="text-white font-medium">
                One pouch of our proprietary powder plus water gives you 5
                gallons of thick, pourable, sprayable slime.
              </span>{" "}
              Load up a pump sprayer. Fill a bucket and send it. It&apos;s
              safe, it washes out, and it&apos;s the most fun your group
              will have all year.
            </p>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 60 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ type: "spring", stiffness: 50, delay: 0.2 }}
          >
            <div className="rounded-3xl overflow-hidden aspect-square relative">
              <img
                src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&h=600&fit=crop"
                alt="Colorful slime"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-lime/20 to-purple/20 mix-blend-overlay" />
            </div>
            {/* Floating badge */}
            <motion.div
              className="absolute -bottom-6 -left-6 bg-lime text-black p-6 rounded-2xl shadow-2xl shadow-lime/20"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="text-3xl font-black">20+</div>
              <div className="text-sm font-medium">Gallons per kit</div>
            </motion.div>
          </motion.div>
        </div>

        {/* Use cases */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.4, type: "spring" }}
        >
          <h3 className="text-3xl sm:text-4xl font-black">
            Perfect For <span className="text-purple">Every Occasion</span>
          </h3>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {highlights.map((item, i) => (
            <motion.div
              key={item.title}
              className="group rounded-3xl overflow-hidden border border-white/10 hover:border-lime/30 transition-colors"
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                delay: 0.5 + i * 0.15,
                type: "spring",
                stiffness: 50,
              }}
              whileHover={{ y: -5 }}
            >
              <div className="aspect-video overflow-hidden relative">
                <motion.img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <div className="p-6">
                <h4 className="text-xl font-bold text-white">{item.title}</h4>
                <p className="text-gray-400 mt-2 text-sm">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
