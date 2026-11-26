/**
 * Shipping weights, boxes and checkout options: the table to edit when a real
 * scale reading replaces an estimate. Client-safe, holds no secrets.
 *
 * Everything is in OUNCES, packed and ready to ship (pouches, instructions,
 * bag), EXCLUDING the box. The box's own weight is added once per parcel.
 *
 * Where each number came from (2026-11-25):
 *   - 20G kit: weighed. Jason shipped one alone at 15.6 oz in the kit box,
 *     minus the box's ~5 oz.
 *   - 40G kit: weighed at 1 lb 7 oz (23 oz) in Sept 2026 in a 9x6x3 box
 *     (~3 oz). Contents ≈ 20 oz.
 *   - 80G kit: ESTIMATE. The two weighed kits give ~2.35 oz per pouch plus
 *     ~1.2 oz of overhead; 80G is 16 pouches.
 *   - Add-ons: ESTIMATES, calibrated to the real 2026-11-21 order (40G + mixer
 *     + 10 goggles + 10 sprayers) that shipped at 5.2 lb in the 24x13x6 box.
 *     Mixer ≈ a steel paint-mixer paddle (~9 oz listed); goggles ≈ Hyper
 *     Tough safety glasses (~1 oz each, plus packaging); sprayers take the
 *     remainder. Weigh one of each and replace these.
 */

export const KIT_CONTENTS_OZ: Record<number, number> = {
  20: 10.6,
  40: 20,
  80: 38.8,
};

export const ADDON_OZ: Record<string, number> = {
  mixer: 9,
  goggles: 1.2,
  sprayers: 2.6,
};

export interface Box {
  id: string;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  /** The empty box's own weight, in ounces. */
  weightOz: number;
}

/**
 * The box used today (2026-11-25, 10x8x5). Fits any one kit, up to an 80G's
 * 16 pouches, but not the accessories.
 */
export const KIT_BOX: Box = { id: "kit", lengthIn: 10, widthIn: 8, heightIn: 5, weightOz: 5 };

/**
 * Box for any order with add-ons, or more pouches than KIT_BOX holds. The
 * size is the one used for the 2026-11-21 accessories order. Its weight is an
 * estimate for corrugated cardboard of that size.
 *
 * Cost warning: at 24x13x6 (1.08 cu ft) UPS bills ~13.5 lb dimensional weight
 * however light the contents. That made it $16.60 to Pittsburgh against $8.40
 * for the kit box. A smaller accessories box is the biggest shipping saving
 * available.
 */
export const ACCESSORY_BOX: Box = { id: "accessory", lengthIn: 24, widthIn: 13, heightIn: 6, weightOz: 16 };

/** Most pouches KIT_BOX holds (one 80G kit). */
export const KIT_BOX_MAX_POUCHES = 16;

/** 1 pouch ≈ 5 gallons, so 20/40/80G = 4/8/16 pouches. */
export const POUCHES_PER_GALLON = 1 / 5;

/** Added on top of the carrier's rate: box, label ($0.05 at Shippo) and packing material. */
export const HANDLING_CENTS = 150;

/** Charged when Shippo can't quote (down, slow, or a bad address). */
export const SHIPPING_FALLBACK_CENTS = 799;

/**
 * The services a customer can choose, in display order. The first is the
 * default and the one made free over the threshold. It is a GROUP: whichever
 * of its tokens is cheaper for the address wins. UPS Ground and UPS Ground
 * Saver often tie, and Ground Saver sometimes beats Ground on heavy boxes.
 *
 * A service the carrier doesn't quote for an address is just left out.
 */
export interface ServiceOption {
  id: string;
  label: string;
  tokens: string[];
}

export const SERVICE_OPTIONS: ServiceOption[] = [
  { id: "ups-ground", label: "UPS Ground", tokens: ["ups_ground_saver", "ups_ground"] },
  { id: "usps-ground", label: "USPS Ground Advantage", tokens: ["usps_ground_advantage"] },
  { id: "usps-priority", label: "USPS Priority Mail", tokens: ["usps_priority"] },
  { id: "ups-2day", label: "UPS 2nd Day Air", tokens: ["ups_second_day_air"] },
];

export const DEFAULT_SERVICE_ID = SERVICE_OPTIONS[0].id;
