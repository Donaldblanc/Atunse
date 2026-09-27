ATUNSE — BEFORE/AFTER WEB ASSETS

15 JPEG images:
- 7 restoration pairs, with matching *-before.jpg / *-after.jpg filenames
- 1 single image (the only exception): jordan4-militaryblack-laces.jpg, a
  composite that shows before, the lace-swap steps and after together. It's
  shown whole in its card, padded to the card's 4:3 with a blurred band of
  the photo itself rather than split into halves

Optimization:
- JPEG quality: 92
- Progressive JPEG
- 4:4:4 chroma (subsampling disabled)
- Original selected crop dimensions retained
- Portrait crops at a ~0.56 width:height ratio; crops leave out any
  "Before"/"After" labels baked into the source (the carousel adds its own)
- No additional image scaling
- Suitable for responsive desktop/mobile delivery

Recommended:
Use width/height attributes and CSS object-fit: cover.
Serve through Next/Image, Vercel Image Optimization, Cloudinary, or equivalent
to generate device-specific sizes at request time.
