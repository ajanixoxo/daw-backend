/**
 * Seed script: creates 15 demo shops with seller accounts and products.
 * Product images are uploaded from local files in DAW- MARKETPLACE folder.
 * Run with:  node src/scripts/seedDemoShops.js
 * Idempotent — skips any shop whose owner email already exists.
 */

require("module-alias/register");
require("dotenv").config();

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const User = require("@models/userModel/user.js");
const Shop = require("@models/marketPlace/shopModel.js");
const Product = require("@models/marketPlace/productModel.js");

// ─── Cloudinary config ───────────────────────────────────────────────────────

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Paths ───────────────────────────────────────────────────────────────────

const MARKETPLACE_ROOT = path.join(__dirname, "../../../DAW- MARKETPLACE");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(name) {
  return (
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
    "-" +
    Date.now()
  );
}

async function uploadLocalImage(filePath, folder = "daw/demo") {
  const buffer = fs.readFileSync(filePath);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/** Normalize a filename stem for case-insensitive matching */
function normalizeStem(s) {
  return s
    .replace(/\.(jpg|jpeg|png|webp)$/i, "")
    .replace(/_+$/, "")
    .trim()
    .toLowerCase();
}

/** Find the image file in a directory whose stem matches productName */
function findImageForProduct(dirPath, productName) {
  if (!fs.existsSync(dirPath)) return null;
  const files = fs
    .readdirSync(dirPath)
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
  const target = normalizeStem(productName);
  const match = files.find((f) => normalizeStem(f) === target);
  return match ? path.join(dirPath, match) : null;
}

/** Find logo or banner file in TOP folder by keyword (e.g. "logo", "banner") */
function findTopFile(shopFolderName, keyword) {
  const topPath = path.join(MARKETPLACE_ROOT, shopFolderName, "TOP");
  if (!fs.existsSync(topPath)) return null;
  const files = fs.readdirSync(topPath);
  const match = files.find((f) => f.toLowerCase().includes(keyword.toLowerCase()));
  return match ? path.join(topPath, match) : null;
}

function getProductDir(shopFolderName) {
  const base = path.join(MARKETPLACE_ROOT, shopFolderName);
  if (fs.existsSync(path.join(base, "PRODUCT"))) return path.join(base, "PRODUCT");
  if (fs.existsSync(path.join(base, "PRODUCTS"))) return path.join(base, "PRODUCTS");
  return null;
}

// ─── Demo data ───────────────────────────────────────────────────────────────

const DEMO_SHOPS = [
  // ── 1. Adaeze's Gems ────────────────────────────────────────────────────
  {
    folder: "ADAEZE_S GEMS",
    user: {
      firstName: "Adaeze",
      lastName: "Obi",
      email: "adaeze.obi@demo.daw.com",
      phone: "08011110005",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Adaeze's Gems",
      description:
        "Handcrafted African jewellery celebrating Nigeria's rich beading and craft traditions. Each piece is made with genuine cowrie shells, coral, adire beads, and bronze accents sourced locally.",
      category: "Jewellery & Accessories",
      contact_number: "08011110005",
      business_address: "12 Balogun Street, Lagos Island, Lagos, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Adire Beaded Bracelet Set",
        description:
          "A vibrant set of three handwoven adire beaded bracelets. Each bracelet features traditional Yoruba patterns in deep indigo and white, made with glass seed beads on an elastic cord. Sold as a set of 3.",
        category: "Bracelets",
        price: 4500,
        quantity: 60,
        variants: [{ type: "Size", values: ["Small", "Medium", "Large"] }],
        productFeatures: "Set of 3 bracelets | Glass seed beads | Elastic cord | Handwoven adire pattern",
        careInstruction: "Keep away from water and direct sunlight to preserve colour.",
        returnPolicy: "Returns accepted within 7 days if item is unworn and in original condition.",
      },
      {
        name: "Coral & Bronze Statement Necklace",
        description:
          "An eye-catching statement necklace combining authentic Nigerian coral beads with handcast bronze pendants. Perfect for traditional ceremonies, aso-ebi events, or everyday elegance. Adjustable chain length.",
        category: "Necklaces",
        price: 12000,
        quantity: 25,
        variants: [{ type: "Length", values: ['16"', '18"', '20"'] }],
        productFeatures: "Genuine coral beads | Handcast bronze pendants | Adjustable chain | Hypoallergenic",
        careInstruction: "Store in a dry pouch. Clean with a soft cloth.",
        returnPolicy: "Returns accepted within 7 days if item is unworn.",
      },
      {
        name: "Cowrie Shell Drop Earrings",
        description:
          "Elegant drop earrings crafted with genuine cowrie shells and gold-plated hooks. A timeless accessory that honours African heritage. Lightweight and comfortable for all-day wear.",
        category: "Earrings",
        price: 3500,
        quantity: 80,
        variants: [{ type: "Hook Material", values: ["Gold-plated", "Silver-plated"] }],
        productFeatures: "Genuine cowrie shells | Gold or silver-plated hooks | Lightweight | 6cm drop length",
        careInstruction: "Avoid contact with perfume, water, and chemicals.",
        returnPolicy: "Returns accepted within 7 days if item is unworn.",
      },
    ],
  },

  // ── 2. Afro Merch Co ────────────────────────────────────────────────────
  {
    folder: "AFRO MERCH CO",
    user: {
      firstName: "Dami",
      lastName: "Akinwande",
      email: "dami.akinwande@demo.daw.com",
      phone: "08011110008",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Afro Merch Co.",
      description:
        "Afrocentric streetwear and accessories celebrating African history, art, and identity. Bold graphics, quality fabric, and unapologetic pride — wearable culture for everyday life.",
      category: "Apparel & Streetwear",
      contact_number: "08011110008",
      business_address: "7 Yaba Tech Road, Yaba, Lagos, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Afro Queen Tote Bag",
        description:
          "A bold canvas tote bag featuring original Afro Queen artwork. Made from heavyweight 100% cotton canvas with reinforced handles. Spacious enough for market runs, school, or weekend outings.",
        category: "Bags",
        price: 8500,
        quantity: 50,
        variants: [{ type: "Color", values: ["Black", "Natural Canvas", "Navy"] }],
        productFeatures: "100% heavyweight cotton canvas | Original artwork print | Reinforced handles | 40×38cm",
        returnPolicy: "Returns accepted within 7 days if unused and in original condition.",
      },
      {
        name: "Queen Idia Mask Shirt",
        description:
          "Premium quality unisex T-shirt featuring a detailed graphic of the iconic Queen Idia mask — a symbol of Benin Kingdom's rich history and female power. Screen-printed on soft 100% combed cotton.",
        category: "T-Shirts",
        price: 6500,
        quantity: 40,
        variants: [
          { type: "Size", values: ["S", "M", "L", "XL", "XXL"] },
          { type: "Color", values: ["Black", "White", "Olive"] },
        ],
        productFeatures: "100% combed cotton | Screen-printed | Unisex cut | Pre-shrunk",
        careInstruction: "Wash inside out in cold water. Do not tumble dry.",
        returnPolicy: "Returns accepted within 7 days if unworn and tags intact.",
      },
    ],
  },

  // ── 3. Bespoke Shoes ────────────────────────────────────────────────────
  {
    folder: "BESPOKE SHOES",
    user: {
      firstName: "Chukwu",
      lastName: "Emeka",
      email: "chukwu.emeka@demo.daw.com",
      phone: "08011110016",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Bespoke Shoes",
      description:
        "Quality men's footwear crafted for style and durability. From classic brogues to casual slippers, every pair is made with premium materials and attention to detail for the modern Nigerian man.",
      category: "Fashion",
      contact_number: "08011110016",
      business_address: "22 Aba Road, Port Harcourt, Rivers State, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Thick Sole Brogue Shoes, PU Leather",
        description:
          "Men's classic brogue shoes with a modern thick sole for added height and comfort. Crafted from durable PU leather with detailed perforated broguing. Suitable for formal and smart-casual occasions.",
        category: "Men's Shoes",
        price: 35000,
        quantity: 20,
        variants: [
          { type: "Size", values: ["40", "41", "42", "43", "44", "45"] },
          { type: "Color", values: ["Black", "Brown", "Tan"] },
        ],
        productFeatures: "PU leather upper | Thick rubber sole | Perforated brogue detailing | Cushioned insole",
        careInstruction: "Wipe clean with a damp cloth. Polish regularly to maintain shine.",
        returnPolicy: "Returns accepted within 7 days for size exchanges. Worn items not accepted.",
      },
      {
        name: "Special Men Slippers",
        description:
          "Comfortable open-toe slippers for the modern man. Features a soft leather upper, anti-slip rubber sole, and cushioned footbed. Perfect for home, lounging, or quick errands.",
        category: "Men's Shoes",
        price: 18000,
        quantity: 35,
        variants: [{ type: "Size", values: ["40", "41", "42", "43", "44", "45"] }],
        productFeatures: "Soft leather upper | Anti-slip rubber sole | Cushioned footbed | Open-toe design",
        careInstruction: "Wipe with a clean cloth. Avoid prolonged exposure to water.",
        returnPolicy: "Returns accepted within 7 days if unworn.",
      },
    ],
  },

  // ── 4. Chioma's Little Stars ─────────────────────────────────────────────
  {
    folder: "CHIOMA_S LITTLE STARS",
    user: {
      firstName: "Chioma",
      lastName: "Nwosu",
      email: "chioma.nwosu@demo.daw.com",
      phone: "08011110013",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Chioma's Little Stars",
      description:
        "Adorable handmade accessories and clothing for babies and toddlers. Every item is designed with love, safety, and African-inspired style — because your little star deserves to shine.",
      category: "Baby & Kids",
      contact_number: "08011110013",
      business_address: "9 New Haven Road, Enugu, Enugu State, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Beaded Crowns",
        description:
          "Handcrafted beaded crowns for babies and toddlers, perfect for naming ceremonies, photo shoots, and special occasions. Made with soft elastic bands and lightweight beads safe for children.",
        category: "Baby Accessories",
        price: 3200,
        quantity: 100,
        variants: [
          { type: "Size", values: ["0-6 months", "6-12 months", "1-3 years"] },
          { type: "Color", values: ["Gold", "Silver", "Pink", "Blue", "Purple"] },
        ],
        productFeatures: "Child-safe beads | Soft elastic band | Lightweight | Handcrafted",
        careInstruction: "Wipe gently with a damp cloth. Do not machine wash.",
        returnPolicy: "Returns accepted within 7 days if unused.",
      },
      {
        name: "Mini Clips",
        description:
          "Cute handmade mini hair clips for baby girls and toddlers. Adorned with fabric flowers, butterflies, and African print accents. Gentle snap clips safe for fine baby hair.",
        category: "Baby Accessories",
        price: 1800,
        quantity: 150,
        variants: [
          { type: "Pack Size", values: ["6-pack", "12-pack"] },
          { type: "Style", values: ["Flowers", "Butterflies", "Ankara Prints"] },
        ],
        productFeatures: "Gentle snap clips | Baby-safe materials | Assorted designs | Handmade",
        careInstruction: "Keep dry. Store in the provided pouch.",
        returnPolicy: "Returns accepted within 7 days if unused.",
      },
    ],
  },

  // ── 5. Chy Ventures ─────────────────────────────────────────────────────
  {
    folder: "CHY VENTURES",
    user: {
      firstName: "Chidinma",
      lastName: "Yusuf",
      email: "chidinma.yusuf@demo.daw.com",
      phone: "08011110017",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Chy Ventures",
      description:
        "Premium quality African wax print fabrics for tailors, fashion designers, and fabric lovers. Stocking a curated selection of exclusive print designs sourced from top mills across West Africa.",
      category: "Fashion",
      contact_number: "08011110017",
      business_address: "5 Textile Lane, Aba, Abia State, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1586495777744-4e6232bf5001?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Hamzat Print",
        description:
          "Exclusive Hamzat wax print fabric — a bold geometric design in rich earth tones. Sold per yard of premium 100% cotton wax print. Ideal for Abayas, kaftans, and tailored traditional wear.",
        category: "Fabrics",
        price: 5500,
        quantity: 80,
        variants: [{ type: "Yards", values: ["1 yard", "3 yards", "6 yards"] }],
        productFeatures: "100% cotton wax print | 45 inches wide | Colourfast dye | Premium mill quality",
        careInstruction: "Hand wash in cold water with mild detergent. Iron on medium heat while damp.",
        returnPolicy: "No returns on cut fabric unless there is a manufacturing defect.",
      },
      {
        name: "Kaly Print",
        description:
          "Vibrant Kaly print fabric featuring a flowing floral motif in bright tropical colours. 100% cotton wax print. Perfect for wrap skirts, dresses, and matching family outfits.",
        category: "Fabrics",
        price: 5500,
        quantity: 80,
        variants: [{ type: "Yards", values: ["1 yard", "3 yards", "6 yards"] }],
        productFeatures: "100% cotton wax print | 45 inches wide | Vibrant colourfast dye | Premium quality",
        careInstruction: "Hand wash in cold water with mild detergent. Iron on medium heat while damp.",
        returnPolicy: "No returns on cut fabric unless there is a manufacturing defect.",
      },
    ],
  },

  // ── 6. Eko Prints Gallery ────────────────────────────────────────────────
  {
    folder: "EKO PRINTS GALLERY",
    user: {
      firstName: "Emeka",
      lastName: "Nwachukwu",
      email: "emeka.nwachukwu@demo.daw.com",
      phone: "08011110007",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Eko Prints Gallery",
      description:
        "Contemporary African art and jewellery by Lagos-based creator Emeka Nwachukwu. Original prints celebrating city life and female forms, alongside handcrafted accessories — each piece a conversation starter.",
      category: "Art & Prints",
      contact_number: "08011110007",
      business_address: "18 Awolowo Road, Ikoyi, Lagos, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Bracelet Women",
        description:
          "A beautifully designed women's bracelet inspired by contemporary Lagos street art. Features interlinked metal loops with hand-painted enamel accents in warm Afrocentric tones. A wearable work of art.",
        category: "Jewellery",
        price: 4200,
        quantity: 60,
        variants: [
          { type: "Size", values: ["Small", "Medium", "Large"] },
          { type: "Color", values: ["Gold/Terracotta", "Silver/Indigo", "Bronze/Ochre"] },
        ],
        productFeatures: "Metal alloy links | Hand-painted enamel | Lobster clasp | Adjustable fit",
        careInstruction: "Avoid contact with water. Store in a dry pouch.",
        returnPolicy: "Returns accepted within 7 days if item is unworn.",
      },
      {
        name: "She Figure",
        description:
          "Limited edition giclee art print — 'She Figure' — a bold celebration of the African female form rendered in expressive strokes of ochre, black, and deep red. Printed on 300gsm archival fine art paper.",
        category: "Art Prints",
        price: 15000,
        quantity: 15,
        variants: [
          { type: "Size", values: ['A4 (21×29cm)', 'A3 (30×42cm)', 'A2 (42×59cm)'] },
        ],
        productFeatures: "Giclee print | 300gsm archival paper | Fade-resistant ink | Unframed | Signed edition",
        returnPolicy: "No returns unless item arrives damaged. Contact us within 48 hours of delivery.",
      },
    ],
  },

  // ── 7. Green Leaf Organics ───────────────────────────────────────────────
  {
    folder: "GREEN LEAF ORGANICS",
    user: {
      firstName: "Yetunde",
      lastName: "Adeleye",
      email: "yetunde.adeleye@demo.daw.com",
      phone: "08011110006",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Green Leaf Organics",
      description:
        "All-natural, plant-based skincare and body care products made from African botanicals. No harsh chemicals, no synthetic fragrances — just pure, effective ingredients your skin will love.",
      category: "Beauty & Skincare",
      contact_number: "08011110006",
      business_address: "3 Opebi Link Road, Ikeja, Lagos, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1556228841-a3c527ebefe5?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Body Oil",
        description:
          "Luxurious all-natural body oil blended from raw shea oil, moringa oil, and sweet almond oil. Deeply moisturises and nourishes skin, leaving it soft, radiant, and glowing. Suitable for all skin types.",
        category: "Body Care",
        price: 4500,
        quantity: 70,
        variants: [{ type: "Size", values: ["50ml", "100ml", "200ml"] }],
        productFeatures: "100% natural ingredients | Cold-pressed oils | No parabens | No synthetic fragrance | Vegan",
        careInstruction: "Apply to damp skin after shower for best absorption. Keep away from direct sunlight.",
        returnPolicy: "Returns accepted within 7 days if product is unopened.",
      },
      {
        name: "Exfoliating Soap",
        description:
          "Natural African black soap infused with ground walnut shell exfoliants and shea butter. Gently removes dead skin cells, unclogs pores, and evens skin tone. Suitable for face and body.",
        category: "Skincare",
        price: 2500,
        quantity: 100,
        variants: [{ type: "Size", values: ["100g", "250g"] }],
        productFeatures: "African black soap base | Walnut shell exfoliant | Shea butter | Handmade | No SLS",
        careInstruction: "Rinse thoroughly. Avoid contact with eyes. Follow with moisturiser.",
        returnPolicy: "Returns accepted within 7 days if product is unopened.",
      },
    ],
  },

  // ── 8. Hauwa Leather Atelier ─────────────────────────────────────────────
  {
    folder: "HAUWA LEATHER ATELIER",
    user: {
      firstName: "Hauwa",
      lastName: "Tanko",
      email: "hauwa.tanko@demo.daw.com",
      phone: "08011110012",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Hauwa Leather Atelier",
      description:
        "Handcrafted premium leather goods from Kano — a city with centuries of leatherwork heritage. Each bag is individually made by skilled artisans using vegetable-tanned leather and traditional stitching techniques.",
      category: "Leather Goods",
      contact_number: "08011110012",
      business_address: "14 Kano Road, Kano, Kano State, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Rucksack",
        description:
          "Full-grain leather rucksack with a roomy main compartment, padded laptop sleeve, and adjustable straps. Handstitched by Kano artisans. Develops a beautiful patina with age. Perfect for work or travel.",
        category: "Bags",
        price: 45000,
        quantity: 15,
        variants: [{ type: "Color", values: ["Tan", "Dark Brown", "Black"] }],
        productFeatures: "Full-grain leather | Padded laptop sleeve (up to 15\") | Brass hardware | Handstitched | 20L capacity",
        careInstruction: "Treat with leather conditioner every 3 months. Store in the dust bag provided.",
        returnPolicy: "Returns accepted within 7 days if item is unused and in original condition.",
      },
      {
        name: "Travelling Size Bag",
        description:
          "Compact leather travel bag, perfect for weekend getaways or carry-on use. Features two external pockets, a main zip compartment, and a trolley sleeve. Built to last a lifetime.",
        category: "Bags",
        price: 28000,
        quantity: 20,
        variants: [{ type: "Color", values: ["Tan", "Dark Brown", "Cognac"] }],
        productFeatures: "Full-grain leather | Trolley sleeve | Brass zips | Top carry handle | Shoulder strap included",
        careInstruction: "Wipe with a clean dry cloth. Condition regularly with leather care cream.",
        returnPolicy: "Returns accepted within 7 days if item is unused and in original condition.",
      },
    ],
  },

  // ── 9. Kemi's Ankara Studio ──────────────────────────────────────────────
  {
    folder: "KEMI_S ANKARA STUDIO",
    user: {
      firstName: "Kemi",
      lastName: "Adeyemi",
      email: "kemi.adeyemi@demo.daw.com",
      phone: "08011110001",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Kemi's Ankara Studio",
      description:
        "Premium Ankara and Atampa wax print fabrics sourced directly from trusted mills. Whether you're a tailor, designer, or fabric collector, find your next statement print at Kemi's Ankara Studio.",
      category: "Fashion",
      contact_number: "08011110001",
      business_address: "14 Balogun Market, Lagos Island, Lagos, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1551489186-cf8726f514f8?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "6 Yards Fabric",
        description:
          "6 yards of premium Ankara wax print fabric — enough for a full outfit plus matching accessories. Features a bold geometric print in vibrant, colourfast dye. 100% cotton, 45 inches wide.",
        category: "Fabrics",
        price: 8500,
        quantity: 60,
        variants: [{ type: "Print Design", values: ["Geometric", "Floral", "Abstract", "Traditional"] }],
        productFeatures: "6 yards length | 100% cotton | 45 inches wide | Premium wax print | Colourfast",
        careInstruction: "Hand wash in cold water. Iron on medium heat while damp.",
        returnPolicy: "No returns on cut fabric unless there is a manufacturing defect.",
      },
      {
        name: "Special Atampa",
        description:
          "A special edition Atampa fabric — the Cameroonian cousin of Ankara wax print — featuring intricate hand-stamped patterns in rich burgundy and gold. Limited stock. 3 yards per roll.",
        category: "Fabrics",
        price: 7500,
        quantity: 45,
        variants: [{ type: "Yards", values: ["3 yards", "6 yards"] }],
        productFeatures: "Hand-stamped pattern | 100% cotton | 45 inches wide | Limited edition | Rich colourway",
        careInstruction: "Hand wash in cold water. Dry flat in the shade.",
        returnPolicy: "No returns on cut fabric unless there is a manufacturing defect.",
      },
    ],
  },

  // ── 10. Korede Kitchen Essentials ────────────────────────────────────────
  {
    folder: "KOREDE KITCHEN ESSENTIALS",
    user: {
      firstName: "Korede",
      lastName: "Balogun",
      email: "korede.balogun@demo.daw.com",
      phone: "08011110010",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Korede Kitchen Essentials",
      description:
        "Quality cookware and kitchen tools for the modern Nigerian home. From complete pot sets to handcrafted wooden utensils — equip your kitchen with tools that make cooking a joy.",
      category: "Kitchen & Dining",
      contact_number: "08011110010",
      business_address: "33 Agege Motor Road, Oshodi, Lagos, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "26 Pieces Cookware",
        description:
          "A complete 26-piece non-stick cookware set including pots, pans, lids, and kitchen accessories. Heavy-gauge aluminium body with PFOA-free non-stick coating. Suitable for gas, electric, and induction cooktops.",
        category: "Cookware",
        price: 85000,
        quantity: 10,
        variants: [{ type: "Color", values: ["Granite Grey", "Marble White", "Copper"] }],
        productFeatures: "26 pieces | Non-stick PFOA-free coating | Induction compatible | Tempered glass lids | Dishwasher safe",
        careInstruction: "Hand wash recommended to extend non-stick life. Use silicone or wooden utensils only.",
        returnPolicy: "Returns accepted within 14 days if item is unused and in original packaging.",
      },
      {
        name: "Teak Wooden Cooking Utensils Set - 9 Piece Kitchen Tool Set with Holder",
        description:
          "A premium 9-piece teak wood cooking utensil set including spatulas, spoons, and a ladle, displayed in a handcrafted wooden holder. Natural teak is naturally antibacterial and heat-resistant. Safe for non-stick cookware.",
        category: "Kitchen Tools",
        price: 12500,
        quantity: 25,
        variants: [],
        productFeatures: "9 pieces + wooden holder | Solid teak wood | Heat-resistant | Antibacterial | Non-stick safe",
        careInstruction: "Hand wash only. Oil with food-grade mineral oil monthly to prevent cracking.",
        returnPolicy: "Returns accepted within 14 days if item is unused.",
      },
    ],
  },

  // ── 11. Lagos Tech Accessories ───────────────────────────────────────────
  {
    folder: "LAGOS TECH ACCESSORIES",
    user: {
      firstName: "Tunde",
      lastName: "Olawale",
      email: "tunde.olawale@demo.daw.com",
      phone: "08011110011",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Lagos Tech Accessories",
      description:
        "Your trusted source for quality laptops and computing devices in Lagos. We supply brand-new and UK-used premium laptops at competitive prices, with warranty and post-sale support.",
      category: "Electronics",
      contact_number: "08011110011",
      business_address: "Computer Village, Ikeja, Lagos, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "HP Pavillion",
        description:
          "HP Pavilion laptop — a reliable everyday computing powerhouse. Features an Intel Core i5 processor, 8GB RAM, 512GB SSD storage, and a 15.6\" Full HD display. Ideal for students, professionals, and creatives.",
        category: "Laptops",
        price: 420000,
        quantity: 8,
        variants: [{ type: "Condition", values: ["Brand New", "UK Used"] }],
        productFeatures: "Intel Core i5 | 8GB RAM | 512GB SSD | 15.6\" Full HD | Windows 11 | 1-year warranty",
        returnPolicy: "Returns accepted within 7 days for hardware defects only.",
      },
      {
        name: "Macbook",
        description:
          "Apple MacBook — sleek, powerful, and built to last. Perfect for creative professionals, developers, and power users. Available in selected configurations. All units thoroughly tested and verified.",
        category: "Laptops",
        price: 850000,
        quantity: 5,
        variants: [
          { type: "Model", values: ["MacBook Air M1", "MacBook Air M2", "MacBook Pro M2"] },
          { type: "Condition", values: ["Brand New", "UK Used"] },
        ],
        productFeatures: "Apple Silicon | Retina display | Up to 18hr battery | macOS Sonoma | 1-year warranty",
        returnPolicy: "Returns accepted within 7 days for hardware defects only.",
      },
    ],
  },

  // ── 12. Naija Naturals ───────────────────────────────────────────────────
  {
    folder: "NAIJA NATURALS",
    user: {
      firstName: "Amaka",
      lastName: "Eze",
      email: "amaka.eze@demo.daw.com",
      phone: "08011110003",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Naija Naturals",
      description:
        "Authentic Nigerian natural body care, crafted from the finest raw shea butter, black soap, and botanical extracts. Rooted in nature, inspired by tradition, made with love in Nigeria.",
      category: "Beauty & Skincare",
      contact_number: "08011110003",
      business_address: "7 Trans-Ekulu, Enugu, Enugu State, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Ivory Butter",
        description:
          "Pure ivory shea butter, unrefined and cold-pressed from shea nuts sourced from Northern Nigeria. Rich in vitamins A, E, and F, it deeply moisturises, soothes, and protects skin. 100% natural with no additives.",
        category: "Body Care",
        price: 3500,
        quantity: 80,
        variants: [{ type: "Size", values: ["100g", "250g", "500g"] }],
        productFeatures: "100% unrefined shea butter | Cold-pressed | No additives | Rich in vitamins A, E & F | Vegan",
        careInstruction: "Keep in a cool, dry place away from direct sunlight.",
        returnPolicy: "Returns accepted within 7 days if product is unopened.",
      },
      {
        name: "Okere Shea Essence",
        description:
          "A luxurious shea butter body lotion enriched with okere (African wild mango) seed oil and vitamin E. Lightweight, fast-absorbing formula that leaves skin silky smooth and hydrated all day.",
        category: "Body Care",
        price: 5500,
        quantity: 60,
        variants: [{ type: "Size", values: ["150ml", "300ml"] }],
        productFeatures: "Shea butter base | Okere seed oil | Vitamin E | Fast-absorbing | No parabens | No mineral oil",
        careInstruction: "Apply to clean skin. Store in a cool dry place.",
        returnPolicy: "Returns accepted within 7 days if product is unopened.",
      },
    ],
  },

  // ── 13. Nupe Craft Studio ────────────────────────────────────────────────
  {
    folder: "NUPE CRAFT STUDIO",
    user: {
      firstName: "Ngozi",
      lastName: "Onwudiwe",
      email: "ngozi.onwudiwe@demo.daw.com",
      phone: "08011110019",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Nupe Craft Studio",
      description:
        "Functional home organisation solutions crafted with quality materials and clean design. From stackable plastic organisers to handcrafted wooden storage, bring order and style to every room.",
      category: "Home & Crafts",
      contact_number: "08011110010",
      business_address: "Minna Township, Niger State, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Plastic Organisers",
        description:
          "Durable stackable plastic organiser set — perfect for wardrobes, kitchens, and offices. Comes in a set of 4 modular trays that click together. Clear design lets you see contents at a glance.",
        category: "Home Organisation",
        price: 6500,
        quantity: 40,
        variants: [
          { type: "Set Size", values: ["4-piece", "8-piece", "12-piece"] },
          { type: "Color", values: ["Clear", "White", "Grey"] },
        ],
        productFeatures: "Stackable modular design | BPA-free plastic | Clear visibility | Dishwasher safe | Easy assembly",
        returnPolicy: "Returns accepted within 14 days if item is unused and in original packaging.",
      },
      {
        name: "Wooden Organisers",
        description:
          "Handcrafted wooden organiser set made from sustainably sourced pine. Features open-top compartments of varying sizes, ideal for desk organisation, bathroom counters, or kitchen storage.",
        category: "Home Organisation",
        price: 9500,
        quantity: 30,
        variants: [
          { type: "Finish", values: ["Natural Pine", "Walnut Stain", "White Painted"] },
        ],
        productFeatures: "Sustainably sourced pine | Sanded smooth finish | Multi-compartment | Handcrafted | Eco-friendly",
        careInstruction: "Wipe with a dry cloth. Avoid prolonged contact with moisture.",
        returnPolicy: "Returns accepted within 14 days if item is unused.",
      },
    ],
  },

  // ── 14. Real Tech Store ──────────────────────────────────────────────────
  {
    folder: "REAL TECH STORE",
    user: {
      firstName: "Segun",
      lastName: "Adekunle",
      email: "segun.adekunle@demo.daw.com",
      phone: "08011110018",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Real Tech Store",
      description:
        "Genuine consumer electronics and audio accessories at the best prices in Nigeria. From Apple accessories to JBL audio — shop with confidence knowing every product is 100% original.",
      category: "Electronics",
      contact_number: "08011110018",
      business_address: "Computer Village, Ikeja, Lagos, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1546435770-a3e736fe7b5e?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Apple Earpods",
        description:
          "Original Apple EarPods with Lightning Connector. The unique design of the EarPods maximises sound output and minimises sound loss. Includes a built-in remote to control music, phone calls, and volume.",
        category: "Audio",
        price: 22000,
        quantity: 30,
        variants: [{ type: "Connector", values: ["Lightning", "USB-C", "3.5mm"] }],
        productFeatures: "Original Apple | Built-in microphone | Remote control | Lightning/USB-C/3.5mm | Included cable",
        returnPolicy: "Returns accepted within 7 days if item is unused and in original sealed packaging.",
      },
      {
        name: "JBL Live 770NC Wireless Over-Ear Adaptive Noise Canceling Headphones",
        description:
          "JBL Live 770NC — premium wireless over-ear headphones with Adaptive Noise Cancellation technology. Up to 65 hours of battery life, hands-free voice assistant support, and JBL's signature deep bass sound.",
        category: "Audio",
        price: 75000,
        quantity: 15,
        variants: [{ type: "Color", values: ["Black", "White", "Blue", "Champagne"] }],
        productFeatures: "Adaptive ANC | 65hr battery | JBL Pro Sound | Bluetooth 5.3 | Multi-point connection | Foldable",
        careInstruction: "Store in the hard case provided. Clean ear cushions with a dry cloth.",
        returnPolicy: "Returns accepted within 7 days if item is unused and in original packaging.",
      },
    ],
  },

  // ── 15. Spice Republic ──────────────────────────────────────────────────
  {
    folder: "SPICE REPUBLIC ",
    user: {
      firstName: "Fatima",
      lastName: "Musa",
      email: "fatima.musa@demo.daw.com",
      phone: "08011110004",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Spice Republic",
      description:
        "Premium dried spices and pepper blends for authentic Nigerian and West African cooking. Sourced directly from local farmers, sun-dried and stone-ground to preserve maximum flavour and aroma.",
      category: "Food & Groceries",
      contact_number: "08011110004",
      business_address: "6 Wuse Market, Wuse Zone 5, Abuja, FCT, Nigeria",
      fallback_logo: "https://images.unsplash.com/photo-1612207898767-7e9f25e4b9b1?w=400&h=400&fit=crop",
      fallback_banner: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Pepper Soup Spice",
        description:
          "A carefully blended pepper soup spice mix made from Uziza seeds, calabash nutmeg, uda, and crayfish. No artificial additives. Just add to your goat meat, fish, or catfish pepper soup for an authentic taste.",
        category: "Spices & Seasonings",
        price: 1800,
        quantity: 150,
        variants: [{ type: "Size", values: ["50g", "100g", "250g"] }],
        productFeatures: "No artificial additives | Stone-ground | Sun-dried ingredients | Airtight packaging | 12-month shelf life",
        careInstruction: "Store in a cool, dry place. Reseal tightly after use.",
        returnPolicy: "Returns accepted within 7 days if product is unopened.",
      },
      {
        name: "Schuan Pepper",
        description:
          "Whole Sichuan peppercorns (locally called Schuan pepper) — a fragrant, slightly citrusy spice used in suya rubs, pepper soups, and special stews. Adds a unique tingly warmth that elevates any dish.",
        category: "Spices & Seasonings",
        price: 2200,
        quantity: 120,
        variants: [{ type: "Size", values: ["50g", "100g"] }],
        productFeatures: "Whole peppercorns | Strong fragrance | No additives | Airtight resealable bag | 12-month shelf life",
        careInstruction: "Store away from heat and moisture. Grind fresh before use for best flavour.",
        returnPolicy: "Returns accepted within 7 days if product is unopened.",
      },
    ],
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("[seed] Connected to MongoDB");

  let created = 0;
  let skipped = 0;

  for (const entry of DEMO_SHOPS) {
    const existing = await User.findOne({ email: entry.user.email });
    if (existing) {
      const existingShop = await Shop.findOne({ owner_id: existing._id });
      if (existingShop) {
        const productCount = await Product.countDocuments({ shop_id: existingShop._id });
        if (productCount > 0) {
          console.log(`[seed] Skipping existing: ${entry.shop.name}`);
          skipped++;
          continue;
        }
        // Shop exists but no products — clean up and retry
        console.log(`[seed] Retrying incomplete shop for: ${entry.shop.name}`);
        await Product.deleteMany({ shop_id: existingShop._id });
        await Shop.deleteOne({ _id: existingShop._id });
      }
      await User.deleteOne({ _id: existing._id });
    }

    const productDir = getProductDir(entry.folder);

    // ── Upload logo ──────────────────────────────────────────────────────
    let logo_url = entry.shop.fallback_logo;
    const logoFile = findTopFile(entry.folder, "logo");
    if (logoFile) {
      try {
        logo_url = await uploadLocalImage(logoFile, "daw/demo/logos");
        console.log(`[seed]   Uploaded logo for ${entry.shop.name}`);
      } catch (e) {
        console.warn(`[seed]   Logo upload failed for ${entry.shop.name}, using fallback:`, e.message);
      }
    }

    // ── Upload banner ────────────────────────────────────────────────────
    let banner_url = entry.shop.fallback_banner;
    const bannerFile = findTopFile(entry.folder, "banner");
    if (bannerFile) {
      try {
        banner_url = await uploadLocalImage(bannerFile, "daw/demo/banners");
        console.log(`[seed]   Uploaded banner for ${entry.shop.name}`);
      } catch (e) {
        console.warn(`[seed]   Banner upload failed for ${entry.shop.name}, using fallback:`, e.message);
      }
    }

    // ── Create user ──────────────────────────────────────────────────────
    const user = await User.create(entry.user);

    // ── Create shop ──────────────────────────────────────────────────────
    const shop = await Shop.create({
      owner_id: user._id,
      name: entry.shop.name,
      store_url: slugify(entry.shop.name),
      description: entry.shop.description,
      category: entry.shop.category,
      contact_number: entry.shop.contact_number,
      business_address: entry.shop.business_address,
      logo_url,
      banner_url,
      status: "active",
    });

    await User.findByIdAndUpdate(user._id, { shop: shop._id });

    // ── Create products ──────────────────────────────────────────────────
    for (const p of entry.products) {
      let imageUrl = null;

      if (productDir) {
        const imgFile = findImageForProduct(productDir, p.name);
        if (imgFile) {
          try {
            imageUrl = await uploadLocalImage(imgFile, "daw/demo/products");
          } catch (e) {
            console.warn(`[seed]   Image upload failed for "${p.name}":`, e.message);
          }
        } else {
          console.warn(`[seed]   No image found for product: "${p.name}" in ${productDir}`);
        }
      }

      // Use uploaded image for both slots (or a generic fallback)
      const images = imageUrl
        ? [imageUrl, imageUrl]
        : ["https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=800&q=80"];

      await Product.create({
        shop_id: shop._id,
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        quantity: p.quantity,
        weight: p.weight || 0.5,
        images,
        status: "available",
        location: entry.shop.business_address,
        variants: p.variants || [],
        productFeatures: p.productFeatures || "",
        careInstruction: p.careInstruction || "",
        returnPolicy: p.returnPolicy || "",
      });
    }

    console.log(
      `[seed] ✓ Created shop "${entry.shop.name}" with ${entry.products.length} products`
    );
    created++;
  }

  console.log(`\n[seed] Done. Created: ${created} shops, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
