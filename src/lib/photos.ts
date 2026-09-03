// Launch-event photo gallery. Files live in /public/photos and are
// pre-optimized WebP (EXIF stripped) — see TEMP/optimize-photos.py for the
// generator. Dimensions are baked in so the grid reserves space and the
// page doesn't shift as tiles load.
//
// Alt text here was written against the full-size originals, not thumbnails.

export interface GalleryPhoto {
  slug: string;
  w: number;
  h: number;
  alt: string;
}

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  {
    slug: "leader-slimed",
    w: 620,
    h: 827,
    alt: "A group leader standing in the field, shirt soaked purple and green, sprayer in hand",
  },
  {
    slug: "guys-slimed",
    w: 620,
    h: 827,
    alt: "Two guys arm in arm, shirts and shorts coated in green slime",
  },
  {
    slug: "laughing-pair",
    w: 620,
    h: 413,
    alt: "Two friends doubled over laughing, one aiming a green sprayer",
  },
  {
    slug: "victory-pose",
    w: 620,
    h: 465,
    alt: "Two friends posing together out on the field, sprayer in hand",
  },
  {
    slug: "group-shot",
    w: 620,
    h: 465,
    alt: "The whole group gathered on the field at sunset after the event",
  },
  {
    slug: "bucket-huddle",
    w: 620,
    h: 827,
    alt: "A huddle of kids reloading their sprayers from the slime pool",
  },
  {
    slug: "crew-sprayers",
    w: 620,
    h: 827,
    alt: "Two friends walking through the crowd with sprayers, covered in slime",
  },
  {
    slug: "mid-field",
    w: 620,
    h: 827,
    alt: "A kid standing in the middle of the field, arms up, thoroughly slimed",
  },
];
