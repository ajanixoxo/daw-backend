/**
 * Seed script: creates 13 demo shops with seller accounts and products.
 * Run with:  node src/scripts/seedDemoShops.js
 * Idempotent — skips any shop whose owner email already exists.
 */

require("module-alias/register");
require("dotenv").config();

const mongoose = require("mongoose");
const User = require("@models/userModel/user.js");
const Shop = require("@models/marketPlace/shopModel.js");
const Product = require("@models/marketPlace/productModel.js");

// ─── helpers ────────────────────────────────────────────────────────────────

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
}

// ─── demo data ───────────────────────────────────────────────────────────────

const DEMO_SHOPS = [
  // ── 1. Ankara fashion ───────────────────────────────────────────────────
  {
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
      description: "Premium hand-crafted Ankara fashion pieces celebrating African culture and style. From bold print dresses to tailored suits, every piece tells a story.",
      category: "Fashion",
      contact_number: "08011110001",
      business_address: "14 Balogun Market, Lagos Island, Lagos, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1551489186-cf8726f514f8?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Ankara Wrap Maxi Dress",
        description: "Vibrant hand-cut Ankara wrap dress with adjustable waist tie. Made from 100% premium wax-print cotton. Available in sizes S–XXL. Perfect for occasions, events, or everyday elegance.",
        category: "Dresses",
        price: 28500,
        quantity: 45,
        status: "available",
        location: "Lagos Island, Lagos",
        images: [
          "https://images.unsplash.com/photo-1590736704728-f4730bb30770?w=800&q=80",
          "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["S", "M", "L", "XL", "XXL"] }],
        productFeatures: "100% wax-print Ankara cotton | Hand-stitched detailing | Adjustable waist tie",
        returnPolicy: "Returns accepted within 7 days if item is unworn and tags intact.",
      },
      {
        name: "Men's Ankara Senator Suit",
        description: "Two-piece Ankara senator suit combining modern tailoring with authentic African wax print. Includes embroidered cap. Ideal for weddings, naming ceremonies, and corporate events.",
        category: "Men's Clothing",
        price: 54000,
        quantity: 30,
        status: "available",
        location: "Lagos Island, Lagos",
        images: [
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
          "https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["M", "L", "XL", "XXL"] }],
        productFeatures: "Premium Ankara wax print | Custom tailored | Comes with matching cap",
        returnPolicy: "No returns on custom-tailored items unless there is a defect.",
      },
      {
        name: "Ankara Headwrap & Gele Set",
        description: "Pre-tied gele and matching headwrap set in stunning Ankara print. No tying skills needed — simply slip on and secure. One size fits all with adjustable elastic.",
        category: "Accessories",
        price: 9800,
        quantity: 120,
        status: "available",
        location: "Lagos Island, Lagos",
        images: [
          "https://images.unsplash.com/photo-1609205807107-2f69ef9f55f7?w=800&q=80",
          "https://images.unsplash.com/photo-1622557850710-1c4c53f0c8f1?w=800&q=80",
        ],
        variants: [{ type: "Print", values: ["Blue Geometric", "Red Floral", "Gold Abstract"] }],
        productFeatures: "Pre-tied | Elastic band | Wax-print Ankara",
        returnPolicy: "7-day return policy on unused items.",
      },
      {
        name: "Ankara Tote Bag",
        description: "Spacious handmade tote bag crafted from durable Ankara fabric with canvas lining. Features an inner zip pocket and magnetic snap closure. Ideal for market runs, office, or travel.",
        category: "Bags",
        price: 16500,
        quantity: 60,
        status: "available",
        location: "Lagos Island, Lagos",
        images: [
          "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80",
          "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80",
        ],
        variants: [{ type: "Print", values: ["Kente Stripe", "Mud Cloth", "Indigo Tie-Dye"] }],
        productFeatures: "Durable canvas lining | Inner zip pocket | Magnetic snap closure | 38cm × 42cm",
        returnPolicy: "Returns accepted within 7 days.",
      },
    ],
  },

  // ── 2. Tech electronics ──────────────────────────────────────────────────
  {
    user: {
      firstName: "Seun",
      lastName: "Okafor",
      email: "seun.okafor@demo.daw.com",
      phone: "08011110002",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "TechHub Lagos",
      description: "Your one-stop destination for premium electronics, gadgets, and smart devices. Genuine products, competitive prices, and fast Lagos-wide delivery.",
      category: "Electronics",
      contact_number: "08011110002",
      business_address: "Computer Village, Ikeja, Lagos, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Wireless Noise-Cancelling Headphones",
        description: "40-hour battery life, active noise cancellation, and studio-quality sound. Foldable design with premium protein-leather ear cushions. Compatible with all Bluetooth devices. Built-in mic for calls.",
        category: "Audio",
        price: 89000,
        quantity: 25,
        status: "available",
        location: "Computer Village, Ikeja, Lagos",
        images: [
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
          "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&q=80",
        ],
        variants: [{ type: "Color", values: ["Midnight Black", "Pearl White", "Rose Gold"] }],
        productFeatures: "40hr battery | ANC | 30m Bluetooth range | Foldable | Built-in mic",
        returnPolicy: "14-day return policy. Must be in original packaging.",
      },
      {
        name: "Smart Watch Pro – Fitness & Health Tracker",
        description: "Track heart rate, blood oxygen, sleep quality, and 50+ workout modes. IP68 water resistant. AMOLED display with 1.8-inch screen. Receive calls and messages. 7-day battery life.",
        category: "Wearables",
        price: 67500,
        quantity: 40,
        status: "available",
        location: "Computer Village, Ikeja, Lagos",
        images: [
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
          "https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=800&q=80",
        ],
        variants: [
          { type: "Color", values: ["Black", "Silver", "Navy Blue"] },
          { type: "Strap", values: ["Silicone", "Stainless Steel"] },
        ],
        productFeatures: "1.8\" AMOLED | IP68 waterproof | 7-day battery | Heart rate + SpO2",
        returnPolicy: "Returns accepted within 14 days if device is undamaged.",
      },
      {
        name: "Portable Power Bank 30,000mAh",
        description: "Charge your phone up to 8x on a single charge. Features three USB ports and one USB-C port with 65W fast-charging. LED power indicator. Built-in overcharge protection. Compact enough to fit in a bag.",
        category: "Power",
        price: 38500,
        quantity: 80,
        status: "available",
        location: "Computer Village, Ikeja, Lagos",
        images: [
          "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=80",
          "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
        ],
        variants: [{ type: "Color", values: ["Black", "White", "Dark Blue"] }],
        productFeatures: "30,000mAh | 65W fast charge | 3× USB-A + 1× USB-C | Overcharge protection",
        returnPolicy: "14-day return. Must be unused and in original packaging.",
      },
      {
        name: "4K Webcam with Ring Light",
        description: "Ultra-clear 4K video with auto-focus and built-in dual stereo microphone. Includes adjustable ring light with 3 colour temperatures. Plug-and-play USB-C. Perfect for remote work, streaming, and online classes.",
        category: "Cameras",
        price: 52000,
        quantity: 35,
        status: "available",
        location: "Computer Village, Ikeja, Lagos",
        images: [
          "https://images.unsplash.com/photo-1593152167544-085d3b9c4938?w=800&q=80",
          "https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=800&q=80",
        ],
        variants: [{ type: "Connection", values: ["USB-C", "USB-A"] }],
        productFeatures: "4K 30fps | Auto-focus | Dual mic | Ring light included | Plug-and-play",
        returnPolicy: "14-day return policy.",
      },
    ],
  },

  // ── 3. Skincare ──────────────────────────────────────────────────────────
  {
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
      description: "Clean, plant-based skincare formulated specifically for melanin-rich skin. Free from sulfates, parabens, and harmful chemicals. Proudly made in Nigeria with locally sourced ingredients.",
      category: "Beauty & Skincare",
      contact_number: "08011110003",
      business_address: "3 Allen Avenue, Ikeja, Lagos, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Shea & Turmeric Brightening Body Butter",
        description: "Rich, whipped body butter blending unrefined shea, turmeric extract, and vitamin C. Fades dark spots, evens skin tone, and deeply moisturises. 200ml jar. No synthetic fragrance.",
        category: "Moisturisers",
        price: 18500,
        quantity: 150,
        status: "available",
        location: "Ikeja, Lagos",
        images: [
          "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=800&q=80",
          "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["100ml", "200ml", "400ml"] }],
        productFeatures: "Unrefined shea butter | Turmeric + Vitamin C | Sulphate-free | Cruelty-free",
        careInstruction: "Apply to damp skin after shower for best absorption.",
        returnPolicy: "No returns on opened skincare products.",
      },
      {
        name: "Black Soap Face Wash with Aloe Vera",
        description: "Traditional African black soap enriched with aloe vera gel and neem oil. Gently cleanses, controls oil, and calms acne-prone skin without stripping moisture. 150ml pump bottle.",
        category: "Cleansers",
        price: 12000,
        quantity: 200,
        status: "available",
        location: "Ikeja, Lagos",
        images: [
          "https://images.unsplash.com/photo-1621760560016-29c8fdc0d7e1?w=800&q=80",
          "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&q=80",
        ],
        variants: [{ type: "Skin Type", values: ["Oily/Acne-Prone", "Dry/Sensitive", "Normal/Combination"] }],
        productFeatures: "Natural African black soap | Aloe vera + Neem | pH-balanced | 150ml",
        careInstruction: "Use morning and night. Follow with moisturiser.",
        returnPolicy: "No returns on opened products.",
      },
      {
        name: "Rosehip & Baobab Face Serum",
        description: "Lightweight vitamin-C serum powered by rosehip oil and baobab extract. Targets hyperpigmentation, uneven skin tone, and early fine lines. 30ml dropper bottle with pipette for precise application.",
        category: "Serums",
        price: 22000,
        quantity: 90,
        status: "available",
        location: "Ikeja, Lagos",
        images: [
          "https://images.unsplash.com/photo-1617897903246-719242758050?w=800&q=80",
          "https://images.unsplash.com/photo-1631390937505-54c08c9d8a11?w=800&q=80",
        ],
        variants: [{ type: "Concern", values: ["Brightening", "Anti-Ageing", "Acne Repair"] }],
        productFeatures: "Rosehip oil | Baobab extract | 10% Vitamin C | 30ml dropper bottle",
        careInstruction: "Apply 3–4 drops to clean face, morning and evening.",
        returnPolicy: "No returns on opened skincare.",
      },
    ],
  },

  // ── 4. African spices & food ─────────────────────────────────────────────
  {
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
      description: "Authentic West African spices, dried herbs, and culinary essentials sourced directly from local farmers across Nigeria and Ghana. No fillers, no preservatives — just pure flavour.",
      category: "Food & Groceries",
      contact_number: "08011110004",
      business_address: "Mile 12 Market, Kosofe, Lagos, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Premium Uda & Ehuru Spice Blend",
        description: "Hand-ground blend of uda (negro pepper) and ehuru (calabash nutmeg) — the essential duo for authentic Ofe Akwu, pepper soup, and native soups. 100g airtight resealable pouch.",
        category: "Spices & Blends",
        price: 4500,
        quantity: 300,
        status: "available",
        location: "Mile 12 Market, Lagos",
        images: [
          "https://images.unsplash.com/photo-1583364398980-ec1a92fc5038?w=800&q=80",
          "https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["50g", "100g", "250g"] }],
        productFeatures: "Sun-dried | Stone-ground | No preservatives | Resealable pouch",
        returnPolicy: "Due to food safety, no returns on opened products.",
      },
      {
        name: "Organic Crayfish (Ground & Whole)",
        description: "Sun-dried, premium Atlantic crayfish from the creeks of Cross River State. Available ground to fine powder or whole for soups. Intensely smoky flavour. 200g jar.",
        category: "Seafood Condiments",
        price: 6800,
        quantity: 250,
        status: "available",
        location: "Mile 12 Market, Lagos",
        images: [
          "https://images.unsplash.com/photo-1615361200141-f45040f367be?w=800&q=80",
          "https://images.unsplash.com/photo-1612966221695-5e7cd0e7c4f2?w=800&q=80",
        ],
        variants: [
          { type: "Form", values: ["Ground (Fine)", "Ground (Coarse)", "Whole"] },
          { type: "Size", values: ["100g", "200g", "500g"] },
        ],
        productFeatures: "Atlantic crayfish | Sun-dried | No additives | Cross River State sourced",
        returnPolicy: "No returns on opened food products.",
      },
      {
        name: "Ogiri Igbo Fermented Locust Bean",
        description: "Traditionally fermented locust bean (ogiri) wrapped in fresh leaves. Adds deep umami richness to egusi, ofe onugbu, and oha soups. Sourced from Anambra artisan fermenters.",
        category: "Fermented Condiments",
        price: 3200,
        quantity: 180,
        status: "available",
        location: "Mile 12 Market, Lagos",
        images: [
          "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80",
          "https://images.unsplash.com/photo-1606787503068-eca96e29820b?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["Small (50g)", "Medium (100g)", "Large (200g)"] }],
        productFeatures: "Artisan fermented | Leaf-wrapped | No artificial preservatives",
        returnPolicy: "No returns on food items.",
      },
      {
        name: "West African Suya Spice Kit",
        description: "Complete suya spice kit with ground kuli-kuli (peanut base), yaji, ginger, and garlic powder measured and ready to marinate 2kg of meat. Includes a recipe card for authentic Abuja-style suya.",
        category: "Spice Kits",
        price: 7500,
        quantity: 200,
        status: "available",
        location: "Mile 12 Market, Lagos",
        images: [
          "https://images.unsplash.com/photo-1559847844-5315695dadae?w=800&q=80",
          "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=800&q=80",
        ],
        variants: [{ type: "Heat Level", values: ["Mild", "Medium", "Extra Hot"] }],
        productFeatures: "Kuli-kuli base | Yaji blend | Recipe card included | Serves 2kg meat",
        returnPolicy: "No returns on food products.",
      },
    ],
  },

  // ── 5. Jewelry ───────────────────────────────────────────────────────────
  {
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
      name: "Adaeze Gems",
      description: "Handcrafted fine jewellery inspired by Igbo heritage. Each piece blends traditional coral, bronze, and cowrie motifs with contemporary design. Ethically sourced materials, crafted in Enugu.",
      category: "Jewellery & Accessories",
      contact_number: "08011110005",
      business_address: "26 Ogui Road, Enugu, Enugu State, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Coral & Bronze Statement Necklace",
        description: "Handstrung coral beads with artisan-cast bronze pendant inspired by Igbo royal jewellery. Adjustable 18-inch chain with lobster clasp. Each piece is unique — slight variations are part of the handmade character.",
        category: "Necklaces",
        price: 65000,
        quantity: 20,
        status: "available",
        location: "Ogui Road, Enugu",
        images: [
          "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80",
          "https://images.unsplash.com/photo-1573408301185-9519f94816b5?w=800&q=80",
        ],
        variants: [{ type: "Length", values: ["16 inch", "18 inch", "20 inch"] }],
        productFeatures: "Natural coral beads | Artisan bronze pendant | Adjustable length | Handcrafted",
        careInstruction: "Avoid contact with water and perfume. Store in pouch provided.",
        returnPolicy: "No returns on jewellery for hygiene reasons unless item is defective.",
      },
      {
        name: "Cowrie Shell Drop Earrings",
        description: "Elegant drop earrings featuring hand-selected cowrie shells on 18K gold-plated hooks. 6cm drop length. Lightweight, hypoallergenic posts. Packaged in a branded gift box — perfect for gifting.",
        category: "Earrings",
        price: 18500,
        quantity: 60,
        status: "available",
        location: "Ogui Road, Enugu",
        images: [
          "https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=800&q=80",
          "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=800&q=80",
        ],
        variants: [{ type: "Style", values: ["Single Cowrie", "Triple Cowrie", "Cluster"] }],
        productFeatures: "18K gold-plated | Natural cowrie shells | Hypoallergenic | Gift box included",
        careInstruction: "Keep away from water and chemicals.",
        returnPolicy: "No returns unless defective.",
      },
      {
        name: "Adire Beaded Bracelet Set (3-Pack)",
        description: "Set of three handwoven bracelets combining glass seed beads in traditional adire indigo patterns. Stretch cord fits most wrists. Stack them or wear individually. Comes tied with raffia ribbon in a cotton drawstring bag.",
        category: "Bracelets",
        price: 12000,
        quantity: 100,
        status: "available",
        location: "Ogui Road, Enugu",
        images: [
          "https://images.unsplash.com/photo-1543294001-f7cd5d7fb516?w=800&q=80",
          "https://images.unsplash.com/photo-1600721391776-b5cd0e0048f9?w=800&q=80",
        ],
        variants: [{ type: "Colour Palette", values: ["Indigo Classic", "Terracotta Warm", "Forest Green"] }],
        productFeatures: "Glass seed beads | Stretch cord | Set of 3 | Cotton drawstring bag",
        careInstruction: "Remove before showering or swimming.",
        returnPolicy: "7-day return on unused sets.",
      },
    ],
  },

  // ── 6. Organic food ──────────────────────────────────────────────────────
  {
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
      name: "GreenLeaf Organics",
      description: "Farm-to-table organic produce and superfood products from certified Nigerian farms. We partner directly with smallholder farmers to bring you the freshest, cleanest food — no pesticides, no shortcuts.",
      category: "Organic Food",
      contact_number: "08011110006",
      business_address: "Agege Motor Road, Ogba, Lagos, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Organic Tiger Nut Flour (Tigernut Powder)",
        description: "Finely milled tiger nut flour from Nigerian-grown tiger nuts. Naturally sweet, gluten-free, and high in resistant starch. Use as a 1:1 wheat flour substitute for pancakes, bread, and cookies. 500g bag.",
        category: "Flours & Baking",
        price: 8500,
        quantity: 200,
        status: "available",
        location: "Ogba, Lagos",
        images: [
          "https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=800&q=80",
          "https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["250g", "500g", "1kg"] }],
        productFeatures: "Gluten-free | Certified organic | High fibre | Natural sweetness | 500g",
        returnPolicy: "No returns on food products once opened.",
      },
      {
        name: "Moringa Leaf Powder – Superfood Grade",
        description: "100% pure drumstick tree (moringa) leaf powder dried at low temperature to preserve nutrients. Rich in iron, calcium, and antioxidants. Add to smoothies, soups, or capsule. 200g resealable pouch.",
        category: "Superfoods",
        price: 6500,
        quantity: 300,
        status: "available",
        location: "Ogba, Lagos",
        images: [
          "https://images.unsplash.com/photo-1622189953980-97de2df8b58f?w=800&q=80",
          "https://images.unsplash.com/photo-1582260771742-5b72e8f1e6cb?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["100g", "200g", "500g"] }],
        productFeatures: "Low-temp dried | 100% pure | No fillers | Certified organic | Resealable",
        returnPolicy: "Sealed products returnable within 7 days. No returns once opened.",
      },
      {
        name: "Cold-Pressed Coconut Oil – Virgin Grade",
        description: "Unrefined, cold-pressed virgin coconut oil from fresh coconut flesh harvested in Ondo State. Retains full aroma, flavour, and medium-chain fatty acids. Multi-use: cooking, hair, and skincare. 500ml glass jar.",
        category: "Oils",
        price: 11000,
        quantity: 150,
        status: "available",
        location: "Ogba, Lagos",
        images: [
          "https://images.unsplash.com/photo-1601565415268-d17d0d9dde57?w=800&q=80",
          "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["250ml", "500ml", "1L"] }],
        productFeatures: "Cold-pressed | Virgin grade | Unrefined | Glass jar | Multi-use",
        returnPolicy: "No returns on food-grade oils once opened.",
      },
      {
        name: "Mixed Nigerian Dried Fruit Pack",
        description: "Assorted pack of sun-dried Nigerian fruits: tiger nuts, dates, coconut chips, and dried pineapple. No added sugar, no sulphites. Great as a snack, trail mix, or smoothie booster. 400g bag.",
        category: "Snacks",
        price: 9200,
        quantity: 180,
        status: "available",
        location: "Ogba, Lagos",
        images: [
          "https://images.unsplash.com/photo-1596591868231-05e808fd131d?w=800&q=80",
          "https://images.unsplash.com/photo-1511688878353-3a2f5be94cd7?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["200g", "400g", "800g"] }],
        productFeatures: "No added sugar | No sulphites | 4 fruit varieties | Resealable bag",
        returnPolicy: "No returns on perishable food items.",
      },
    ],
  },

  // ── 7. African art prints ────────────────────────────────────────────────
  {
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
      description: "Original contemporary African art prints celebrating Yoruba, Igbo, and Hausa visual traditions. Limited edition giclée prints signed by the artist. Ships worldwide with tracking.",
      category: "Art & Prints",
      contact_number: "08011110007",
      business_address: "Nike Art Gallery, Lekki Phase 1, Lagos, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "\"Eko Bridge at Dawn\" – Limited Edition Giclée Print",
        description: "Stunning sunrise cityscape of Lagos' Eko Bridge rendered in oil-paint technique. Archival pigment ink on 300gsm acid-free cotton rag. Limited edition of 50 prints — each hand-signed and numbered. Arrives with certificate of authenticity.",
        category: "Cityscape Prints",
        price: 85000,
        quantity: 15,
        status: "available",
        location: "Lekki Phase 1, Lagos",
        images: [
          "https://images.unsplash.com/photo-1549887534-1541e9326642?w=800&q=80",
          "https://images.unsplash.com/photo-1578926288207-a90a73b5c04c?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["A3 (30×42cm)", "A2 (42×59cm)", "A1 (59×84cm)"] }],
        productFeatures: "Limited edition 50 prints | Hand-signed | 300gsm cotton rag | Certificate of authenticity",
        returnPolicy: "All sales of original art are final. Damaged-in-transit claims accepted within 48 hours.",
      },
      {
        name: "\"Mama's Market\" – West African Life Series Print",
        description: "Vibrant market scene capturing the energy of a West African Saturday morning market. Bold colours, intricate detail. Open edition archival print on heavyweight matte paper. Perfect for home or office.",
        category: "Cultural Prints",
        price: 42000,
        quantity: 40,
        status: "available",
        location: "Lekki Phase 1, Lagos",
        images: [
          "https://images.unsplash.com/photo-1516714819001-8ee7a13b71d7?w=800&q=80",
          "https://images.unsplash.com/photo-1578926288207-a90a73b5c04c?w=800&q=80",
        ],
        variants: [
          { type: "Size", values: ["A4 (21×30cm)", "A3 (30×42cm)", "A2 (42×59cm)"] },
          { type: "Finish", values: ["Matte", "Gloss"] },
        ],
        productFeatures: "Open edition | Archival inks | Heavyweight matte or gloss | Ready to frame",
        returnPolicy: "Returns accepted for damaged prints within 7 days.",
      },
      {
        name: "Abstract Adire Canvas Wall Art",
        description: "Hand-painted abstract artwork inspired by traditional Yoruba adire eleko tie-dye patterns. Acrylic on stretched canvas, ready to hang. Each canvas is one-of-a-kind. Deep 3.5cm gallery-wrap frame.",
        category: "Original Canvas",
        price: 135000,
        quantity: 8,
        status: "available",
        location: "Lekki Phase 1, Lagos",
        images: [
          "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=800&q=80",
          "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["60×60cm", "80×80cm", "100×100cm"] }],
        productFeatures: "Original one-of-a-kind | Acrylic on canvas | Gallery-wrap 3.5cm frame | Ready to hang",
        returnPolicy: "All original artwork sales are final.",
      },
    ],
  },

  // ── 8. Merch / streetwear ────────────────────────────────────────────────
  {
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
      description: "Pan-African streetwear that speaks culture. Graphic tees, hoodies, and accessories celebrating Afrobeats, African history, and diaspora pride. Printed on demand in Lagos using eco-friendly inks.",
      category: "Apparel & Streetwear",
      contact_number: "08011110008",
      business_address: "7 Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1529720317453-c8da503f2051?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "\"Africa Is Not A Country\" Premium Graphic Tee",
        description: "Premium 230gsm combed cotton t-shirt with bold typographic print celebrating African diversity. Garment-dyed for rich, lasting colour. Pre-shrunk. Regular unisex fit. Sizes XS–4XL.",
        category: "T-Shirts",
        price: 16500,
        quantity: 200,
        status: "available",
        location: "Lekki Phase 1, Lagos",
        images: [
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80",
          "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80",
        ],
        variants: [
          { type: "Size", values: ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"] },
          { type: "Color", values: ["Black", "White", "Forest Green", "Burgundy"] },
        ],
        productFeatures: "230gsm combed cotton | Garment-dyed | Pre-shrunk | Unisex fit",
        returnPolicy: "Size exchanges accepted within 14 days. Must be unworn.",
      },
      {
        name: "Afrobeats Legends Hoodie",
        description: "Heavy 380gsm brushed fleece hoodie featuring a collage print of iconic Afrobeats artists. Double-lined hood, kangaroo pocket, ribbed cuffs. Embroidered logo on chest. Machine washable.",
        category: "Hoodies",
        price: 38500,
        quantity: 80,
        status: "available",
        location: "Lekki Phase 1, Lagos",
        images: [
          "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
          "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80",
        ],
        variants: [
          { type: "Size", values: ["S", "M", "L", "XL", "2XL", "3XL"] },
          { type: "Color", values: ["Black", "Charcoal Grey", "Navy"] },
        ],
        productFeatures: "380gsm brushed fleece | Embroidered logo | Double-lined hood | Machine wash",
        returnPolicy: "Exchanges within 14 days. Unworn with tags attached.",
      },
      {
        name: "Pan-African Flag Snapback Cap",
        description: "6-panel snapback with embroidered Pan-African colours (red, black, green). Flat brim. Structured crown. Adjustable snap closure for a universal fit. Sweatband inside for comfort.",
        category: "Headwear",
        price: 14000,
        quantity: 120,
        status: "available",
        location: "Lekki Phase 1, Lagos",
        images: [
          "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=800&q=80",
          "https://images.unsplash.com/photo-1534215754734-18e55d13e346?w=800&q=80",
        ],
        variants: [{ type: "Color", values: ["Black/Tri-colour", "White/Tri-colour", "Olive/Tri-colour"] }],
        productFeatures: "6-panel | Structured crown | Flat brim | Snapback | Sweatband",
        returnPolicy: "Returns within 7 days if unworn.",
      },
    ],
  },

  // ── 9. Kitchen & restaurant supplies ────────────────────────────────────
  {
    user: {
      firstName: "Korede",
      lastName: "Balogun",
      email: "korede.balogun@demo.daw.com",
      phone: "08011110009",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Korede Kitchen Essentials",
      description: "Professional-grade kitchen tools, cookware, and restaurant supplies for home chefs and food business owners. Quality products at prices that make sense for the Nigerian market.",
      category: "Kitchen & Dining",
      contact_number: "08011110009",
      business_address: "Trade Fair Complex, Ojo, Lagos, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "6-Piece Stainless Steel Cooking Pot Set",
        description: "Heavy-gauge 18/10 stainless steel pot set: 2L, 3L, 4L, 5L, 6L, and 8L with matching lids. Works on gas, electric, and induction hobs. Riveted steel handles stay cool. Dishwasher safe.",
        category: "Cookware",
        price: 78000,
        quantity: 30,
        status: "available",
        location: "Ojo, Lagos",
        images: [
          "https://images.unsplash.com/photo-1588359348347-9bc6cbbb689e?w=800&q=80",
          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
        ],
        variants: [{ type: "Set Size", values: ["4-piece", "6-piece", "8-piece"] }],
        productFeatures: "18/10 stainless steel | Induction-compatible | 6 pots + lids | Dishwasher safe",
        returnPolicy: "Returns accepted within 14 days if unused.",
      },
      {
        name: "Professional Chef's Knife Set – 5 Piece",
        description: "German high-carbon stainless steel blade set: 8\" chef, 7\" santoku, 6\" boning, 5\" utility, and 3.5\" paring knife. Full-tang construction. Ergonomic pakkawood handles. Comes with a magnetic acacia wood block.",
        category: "Knives & Cutlery",
        price: 95000,
        quantity: 20,
        status: "available",
        location: "Ojo, Lagos",
        images: [
          "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
          "https://images.unsplash.com/photo-1544781566-c3ba69d20c59?w=800&q=80",
        ],
        variants: [{ type: "Handle Color", values: ["Brown Pakkawood", "Black Pakkawood"] }],
        productFeatures: "German high-carbon steel | Full-tang | Pakkawood handles | Magnetic acacia block",
        returnPolicy: "14-day returns on unused items with original packaging.",
      },
      {
        name: "Cast Iron Dutch Oven – 5.5L",
        description: "Pre-seasoned 5.5L cast iron dutch oven with enamel interior. Perfect for egusi soup, pepper soup, jollof rice, and slow braises. Even heat distribution, oven-safe to 260°C. Self-basting lid.",
        category: "Cookware",
        price: 68000,
        quantity: 25,
        status: "available",
        location: "Ojo, Lagos",
        images: [
          "https://images.unsplash.com/photo-1517637382994-f02da38c6728?w=800&q=80",
          "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800&q=80",
        ],
        variants: [{ type: "Color", values: ["Classic Red", "Midnight Blue", "Black"] }],
        productFeatures: "Pre-seasoned | Enamel interior | 5.5L | Oven-safe 260°C | Self-basting lid",
        returnPolicy: "14-day return if unused and undamaged.",
      },
    ],
  },

  // ── 10. Handmade crafts / pottery ────────────────────────────────────────
  {
    user: {
      firstName: "Ngozi",
      lastName: "Onwudiwe",
      email: "ngozi.onwudiwe@demo.daw.com",
      phone: "08011110010",
      password: "Demo@1234",
      roles: ["seller", "buyer"],
      country: "Nigeria",
      currency: "NGN",
      isVerified: true,
    },
    shop: {
      name: "Nupe Craft Studio",
      description: "Handcrafted pottery, woven baskets, and terracotta homeware rooted in Nupe craft traditions from Niger State. Every piece is wheel-thrown or hand-built in our studio and fired in a wood kiln.",
      category: "Home & Crafts",
      contact_number: "08011110010",
      business_address: "Bida Craft Village, Bida, Niger State, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Hand-Thrown Terracotta Storage Jar with Lid",
        description: "Wood-kiln-fired terracotta jar with hand-applied iron-oxide geometric decoration. Tight-fitting lid with clay knob. Food-safe glaze interior. Perfect for storing spices, grains, or as a display piece. Approx. 18cm tall.",
        category: "Storage & Jars",
        price: 34000,
        quantity: 25,
        status: "available",
        location: "Bida, Niger State",
        images: [
          "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
          "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80",
        ],
        variants: [{ type: "Size", values: ["Small (12cm)", "Medium (18cm)", "Large (24cm)"] }],
        productFeatures: "Wood-kiln fired | Food-safe glaze | Hand-decorated | Approx. 18cm tall",
        careInstruction: "Hand wash only. Do not microwave.",
        returnPolicy: "Returns accepted within 14 days if undamaged.",
      },
      {
        name: "Woven Raffia Serving Tray",
        description: "Hand-woven raffia tray with geometric patterns in natural earth tones. Sturdy double-woven base. 40cm diameter. Suitable for serving bread, fruits, and condiments or as a decorative wall piece.",
        category: "Tableware",
        price: 22000,
        quantity: 50,
        status: "available",
        location: "Bida, Niger State",
        images: [
          "https://images.unsplash.com/photo-1512207739361-b9eedbbe3c89?w=800&q=80",
          "https://images.unsplash.com/photo-1610725664285-7c57e6eeac3f?w=800&q=80",
        ],
        variants: [{ type: "Pattern", values: ["Earth Chevron", "Indigo Diamond", "Natural Herringbone"] }],
        productFeatures: "Hand-woven raffia | Double-woven base | 40cm diameter | Food-safe",
        careInstruction: "Wipe clean with a damp cloth. Do not submerge.",
        returnPolicy: "Returns within 7 days if item is in original condition.",
      },
      {
        name: "Ceramic Adire Mug Set (Set of 2)",
        description: "Pair of 350ml wheel-thrown ceramic mugs with hand-painted adire-inspired cobalt glaze. Microwave and dishwasher safe. Sturdy D-handle. Gift-wrapped in recycled kraft paper. Each set is uniquely hand-painted.",
        category: "Mugs & Drinkware",
        price: 28500,
        quantity: 40,
        status: "available",
        location: "Bida, Niger State",
        images: [
          "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&q=80",
          "https://images.unsplash.com/photo-1572965733955-08b4ae2b95c6?w=800&q=80",
        ],
        variants: [{ type: "Glaze Color", values: ["Cobalt Blue", "Forest Green", "Terracotta Rust"] }],
        productFeatures: "350ml | Wheel-thrown | Microwave + dishwasher safe | Gift-wrapped | Set of 2",
        careInstruction: "Dishwasher safe on gentle cycle. Microwave safe.",
        returnPolicy: "Unused sets returnable within 7 days.",
      },
    ],
  },

  // ── 11. Tech accessories ─────────────────────────────────────────────────
  {
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
      description: "Premium phone cases, laptop sleeves, desk setups, and productivity accessories. Compatible with the latest devices. Fast delivery across Lagos with same-day dispatch before 12pm.",
      category: "Tech Accessories",
      contact_number: "08011110011",
      business_address: "Yaba Tech Cluster, Herbert Macaulay Way, Yaba, Lagos",
      logo_url: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Laptop Sleeve with Handle – 13\" to 16\"",
        description: "Neoprene padded sleeve with Ankara-print outer fabric and fleece-lined interior. Side accessory pocket with zip. Compatible with MacBook, Dell XPS, Lenovo, and HP laptops. Available in three print styles.",
        category: "Laptop Bags",
        price: 18500,
        quantity: 80,
        status: "available",
        location: "Yaba, Lagos",
        images: [
          "https://images.unsplash.com/photo-1544158828-79d5b66db5e0?w=800&q=80",
          "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=80",
        ],
        variants: [
          { type: "Size", values: ["13 inch", "14 inch", "15.6 inch", "16 inch"] },
          { type: "Print", values: ["Kente Gold", "Indigo Ankara", "Black Adire"] },
        ],
        productFeatures: "Neoprene padded | Fleece-lined | Side zip pocket | Ankara outer fabric",
        returnPolicy: "Returns accepted within 7 days if unused.",
      },
      {
        name: "Wireless Charging Pad – 15W Fast Charge",
        description: "Qi-certified 15W fast wireless charging pad compatible with iPhone 12+, Samsung Galaxy S21+, and all Qi devices. Non-slip base. LED indicator. Includes 1.5m braided USB-C cable. Ultra-thin 8mm profile.",
        category: "Chargers",
        price: 14500,
        quantity: 150,
        status: "available",
        location: "Yaba, Lagos",
        images: [
          "https://images.unsplash.com/photo-1615680022647-99c397cbcaea?w=800&q=80",
          "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80",
        ],
        variants: [{ type: "Color", values: ["Black", "White"] }],
        productFeatures: "15W Qi-certified | 8mm thin | LED indicator | Braided USB-C cable included",
        returnPolicy: "14-day return if device is unused and in original box.",
      },
      {
        name: "Mechanical Gaming Keyboard – TKL Compact",
        description: "Tenkeyless compact layout with Outemu blue mechanical switches. RGB per-key backlighting with 18 preset effects. USB-C detachable cable. Double-shot PBT keycaps. Aluminium top plate. Anti-ghosting N-key rollover.",
        category: "Keyboards",
        price: 52000,
        quantity: 30,
        status: "available",
        location: "Yaba, Lagos",
        images: [
          "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80",
          "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&q=80",
        ],
        variants: [
          { type: "Switch Type", values: ["Blue (Clicky)", "Red (Linear)", "Brown (Tactile)"] },
          { type: "Color", values: ["Black", "White/Grey"] },
        ],
        productFeatures: "TKL | RGB per-key | USB-C detachable | PBT keycaps | Aluminium plate | N-key rollover",
        returnPolicy: "Returns within 14 days if unopened. Defective items replaced.",
      },
    ],
  },

  // ── 12. Leather goods ────────────────────────────────────────────────────
  {
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
      description: "Bespoke leather goods handcrafted in Kano using traditional Hausa tanning methods alongside modern design principles. Full-grain vegetable-tanned leather with hand-stitched saddle-stitch finishing.",
      category: "Leather Goods",
      contact_number: "08011110012",
      business_address: "Kurmi Market, Kano Municipal, Kano State, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1473188588951-666fce8e7c68?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Full-Grain Leather Messenger Bag",
        description: "Spacious A4-compatible messenger bag in full-grain vegetable-tanned cowhide. Ages beautifully over time. Brass hardware. Adjustable shoulder strap. Interior: laptop sleeve, document pocket, 3 card slots. Hand-stitched in Kano.",
        category: "Bags",
        price: 125000,
        quantity: 15,
        status: "available",
        location: "Kurmi Market, Kano",
        images: [
          "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
          "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&q=80",
        ],
        variants: [{ type: "Color", values: ["Tan", "Dark Brown", "Cognac"] }],
        productFeatures: "Full-grain vegetable-tanned | Brass hardware | Laptop sleeve | Hand-stitched",
        careInstruction: "Condition with beeswax leather balm every 3–6 months. Avoid prolonged exposure to water.",
        returnPolicy: "Returns within 14 days on unused items. Bespoke orders are non-returnable.",
      },
      {
        name: "Hand-Stitched Leather Bifold Wallet",
        description: "Slim bifold wallet in full-grain goatskin with 6 card slots, two bill compartments, and an ID window. Saddle-stitched with waxed linen thread. Personalisable with hot-stamped initials. Packaged in a branded cloth pouch.",
        category: "Wallets",
        price: 38000,
        quantity: 50,
        status: "available",
        location: "Kurmi Market, Kano",
        images: [
          "https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80",
          "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=800&q=80",
        ],
        variants: [
          { type: "Color", values: ["Natural Tan", "Dark Brown", "Black"] },
          { type: "Personalisation", values: ["No Initials", "Initials (+₦3,000)"] },
        ],
        productFeatures: "Full-grain goatskin | 6 card slots | ID window | Saddle-stitched | Cloth pouch",
        careInstruction: "Apply leather conditioner twice yearly. Keep away from moisture.",
        returnPolicy: "Returns accepted within 7 days for non-personalised items.",
      },
      {
        name: "Leather & Adire Fabric Sandals",
        description: "Handcrafted flat sandals combining vegetable-tanned leather soles with adire fabric upper straps. Cork-padded insole for comfort. Adjustable ankle strap. Resoleable. Available in whole sizes 36–45.",
        category: "Footwear",
        price: 48000,
        quantity: 30,
        status: "available",
        location: "Kurmi Market, Kano",
        images: [
          "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80",
          "https://images.unsplash.com/photo-1603487742131-4160ec999306?w=800&q=80",
        ],
        variants: [
          { type: "Size", values: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"] },
          { type: "Fabric", values: ["Indigo Adire", "Terracotta Adire", "Black & White Adire"] },
        ],
        productFeatures: "Vegetable-tanned sole | Cork insole | Adire fabric straps | Resoleable | Adjustable ankle strap",
        careInstruction: "Clean leather parts with a damp cloth. Condition quarterly.",
        returnPolicy: "Exchanges within 7 days for size issues.",
      },
    ],
  },

  // ── 13. Baby & kids ──────────────────────────────────────────────────────
  {
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
      description: "Safe, natural, and lovingly designed products for babies and children 0–8 years. From organic clothing to educational toys and natural baby skincare — every product is toxin-free and Nigeria-tested.",
      category: "Baby & Kids",
      contact_number: "08011110013",
      business_address: "12 Fola Osibo Road, Lekki Phase 1, Lagos, Nigeria",
      logo_url: "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=400&h=400&fit=crop",
      banner_url: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=1200&h=400&fit=crop",
    },
    products: [
      {
        name: "Organic Cotton Baby Onesie Set (5-Pack)",
        description: "Five-piece set of GOTS-certified organic cotton short-sleeve onesies in pastel prints. Tagless for sensitive skin. Snap fastening at crotch for easy nappy changes. Pre-washed and preshrunk. Sizes NB to 24 months.",
        category: "Baby Clothing",
        price: 22500,
        quantity: 100,
        status: "available",
        location: "Lekki Phase 1, Lagos",
        images: [
          "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=800&q=80",
          "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=800&q=80",
        ],
        variants: [
          { type: "Size", values: ["Newborn", "0–3m", "3–6m", "6–9m", "9–12m", "12–18m", "18–24m"] },
          { type: "Print Set", values: ["Pastel Rainbow", "Animal Safari", "Geometric Brights"] },
        ],
        productFeatures: "GOTS certified organic cotton | Tagless | Snap crotch | Pre-washed | Set of 5",
        careInstruction: "Machine wash at 30°C. Tumble dry low. Do not bleach.",
        returnPolicy: "Unopened sets returnable within 14 days.",
      },
      {
        name: "Wooden Stacking Rings Educational Toy",
        description: "Classic 10-ring wooden stacking toy in non-toxic water-based paint. Develops colour recognition, motor skills, and hand-eye coordination. Smooth sanded edges. Suitable for 6 months+. Comes in a cotton drawstring bag.",
        category: "Toys & Education",
        price: 9800,
        quantity: 80,
        status: "available",
        location: "Lekki Phase 1, Lagos",
        images: [
          "https://images.unsplash.com/photo-1555252334-05536bd0f2d2?w=800&q=80",
          "https://images.unsplash.com/photo-1530325553241-4f6e7690cf36?w=800&q=80",
        ],
        variants: [{ type: "Color Scheme", values: ["Rainbow Classic", "Pastel Natural", "Monochrome"] }],
        productFeatures: "Solid wood | Non-toxic paint | 10 rings | Age 6m+ | Cotton bag | CE certified",
        careInstruction: "Wipe clean with a dry cloth. Do not submerge in water.",
        returnPolicy: "Returns within 14 days if unopened and in original condition.",
      },
      {
        name: "Natural Baby Massage Oil – Calming Lavender",
        description: "Gentle baby massage oil blended from organic sunflower, sweet almond, and calendula oils with a touch of lavender essential oil. Dermatologically tested. Fragrance-free option also available. 150ml bottle. Suitable from birth.",
        category: "Baby Skincare",
        price: 8500,
        quantity: 200,
        status: "available",
        location: "Lekki Phase 1, Lagos",
        images: [
          "https://images.unsplash.com/photo-1556760544-74068565f05c?w=800&q=80",
          "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800&q=80",
        ],
        variants: [{ type: "Scent", values: ["Calming Lavender", "Fragrance-Free"] }],
        productFeatures: "Organic oils | Dermatologically tested | Suitable from birth | 150ml | Paraben-free",
        careInstruction: "External use only. Avoid contact with eyes. Patch test before first use.",
        returnPolicy: "No returns on opened skincare.",
      },
      {
        name: "Padded Waterproof Changing Mat",
        description: "Portable padded changing mat with wipe-clean waterproof PVC cover over foam insert. Folds in thirds to fit in a nappy bag. Includes safety strap and two removable pockets. 70cm × 50cm when open.",
        category: "Nursery & Changing",
        price: 14500,
        quantity: 60,
        status: "available",
        location: "Lekki Phase 1, Lagos",
        images: [
          "https://images.unsplash.com/photo-1543373072-05a5d1b2cc67?w=800&q=80",
          "https://images.unsplash.com/photo-1555252334-05536bd0f2d2?w=800&q=80",
        ],
        variants: [{ type: "Color", values: ["Sage Green", "Cloud Grey", "Blush Pink", "Sky Blue"] }],
        productFeatures: "Wipe-clean PVC | Foam padded | Safety strap | 2 pockets | Foldable | 70×50cm",
        careInstruction: "Wipe with damp cloth and mild disinfectant. Do not machine wash.",
        returnPolicy: "Returns accepted within 14 days if unused.",
      },
    ],
  },
];

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("[seed] Connected to MongoDB");

  let created = 0;
  let skipped = 0;

  for (const entry of DEMO_SHOPS) {
    const existing = await User.findOne({ email: entry.user.email });
    if (existing) {
      console.log(`[seed] Skipping existing: ${entry.shop.name}`);
      skipped++;
      continue;
    }

    // Create seller user (password hashed by pre-save hook)
    const user = await User.create(entry.user);

    // Create shop
    const shop = await Shop.create({
      owner_id: user._id,
      name: entry.shop.name,
      store_url: slugify(entry.shop.name),
      description: entry.shop.description,
      category: entry.shop.category,
      contact_number: entry.shop.contact_number,
      business_address: entry.shop.business_address,
      logo_url: entry.shop.logo_url,
      banner_url: entry.shop.banner_url,
      status: "active",
    });

    // Link shop to user
    await User.findByIdAndUpdate(user._id, { shop: shop._id });

    // Create products
    for (const p of entry.products) {
      await Product.create({
        shop_id: shop._id,
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        quantity: p.quantity,
        images: p.images,
        status: p.status,
        variants: p.variants || [],
        productFeatures: p.productFeatures || "",
        careInstruction: p.careInstruction || "",
        returnPolicy: p.returnPolicy || "",
      });
    }

    console.log(`[seed] ✓ Created shop "${entry.shop.name}" with ${entry.products.length} products`);
    created++;
  }

  console.log(`\n[seed] Done. Created: ${created} shops, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
