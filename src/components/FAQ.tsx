"use client";

import { motion, AnimatePresence, useInView } from "framer-motion";
import { useRef, useState } from "react";

const faqs = [
  {
    question: "What is the slime made of?",
    answer:
      "Our slime powder is a safe, non-toxic formula. Just add water and it transforms into thick, colorful slime. No glue, no borax, no complicated ingredients to measure.",
  },
  {
    question: "How much slime does each pouch make?",
    answer:
      "Each pouch makes approximately 5 gallons of slime. Our kits come with 4 pouches (one per color), giving you 20 gallons total. The Youth Group Kit comes with 16 pouches for 80 gallons.",
  },
  {
    question: "Is it safe for kids?",
    answer:
      "Yes! Our formula is non-toxic and safe for all ages. It washes off easily with water — from skin, clothing, and most surfaces. We recommend adult supervision for younger children.",
  },
  {
    question: "How do I clean up?",
    answer:
      "The best part — it cleans up with just water! Hose down outdoor areas, or use a wet towel for indoor messes. Clothing washes clean in a normal laundry cycle.",
  },
  {
    question: "How long does the slime last?",
    answer:
      "Mixed slime is best used within 24-48 hours. The dry powder pouches have a shelf life of over a year when stored in a cool, dry place.",
  },
  {
    question: "Do you ship internationally?",
    answer:
      "Currently we ship within the United States. International shipping is coming soon. Sign up for our newsletter to be notified.",
  },
];

function FAQItem({
  faq,
  index,
}: {
  faq: (typeof faqs)[0];
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      className="border-b border-white/10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
    >
      <button
        className="w-full py-6 flex items-center justify-between text-left group"
        onClick={() => setOpen(!open)}
      >
        <span className="text-lg font-medium text-white group-hover:text-lime transition-colors pr-4">
          {faq.question}
        </span>
        <motion.span
          className="text-lime text-2xl shrink-0"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="text-gray-400 pb-6 leading-relaxed">{faq.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FAQ() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="faq" className="py-32 px-6" ref={ref}>
      <div className="max-w-3xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ type: "spring", stiffness: 50 }}
        >
          <span className="text-lime text-sm font-bold tracking-widest uppercase">
            FAQ
          </span>
          <h2 className="text-4xl sm:text-5xl font-black mt-4">
            Got <span className="text-lime">Questions?</span>
          </h2>
        </motion.div>

        {isInView && (
          <div>
            {faqs.map((faq, i) => (
              <FAQItem key={faq.question} faq={faq} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
