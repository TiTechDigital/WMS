import type { Category, Product, StorageCondition, UnitOfMeasure } from "@/types";
import { createRng } from "@/lib/random";
import { REFERENCE_NOW } from "@/lib/constants";

type Template = {
  name: string;
  brand: string;
  uom: UnitOfMeasure;
  kg: number;
  dims: [number, number, number];
  cost: number;
  variants?: string[];
  storage?: StorageCondition;
  desc: string;
};

const T: Record<Category, Template[]> = {
  Electronics: [
    { name: "USB-C Charging Cable 2m", brand: "Voltix", uom: "EA", kg: 0.08, dims: [12, 9, 2], cost: 3.4, variants: ["Black", "White"], desc: "Braided USB-C to USB-C cable, 100W PD, 2 metre length." },
    { name: "Wireless Barcode Scanner", brand: "Scanlo", uom: "EA", kg: 0.32, dims: [18, 10, 8], cost: 64, storage: "high-value", desc: "2D imager with 2.4GHz dongle, IP54 rated, 30m range." },
    { name: "Thermal Label Printer 4in", brand: "Scanlo", uom: "EA", kg: 2.1, dims: [28, 22, 20], cost: 189, storage: "high-value", desc: "Direct thermal desktop printer, 203 dpi, USB/Ethernet." },
    { name: "LED Panel Light 60x60", brand: "Lumora", uom: "EA", kg: 3.2, dims: [62, 62, 4], cost: 28.5, variants: ["4000K", "6500K"], desc: "Recessed 40W LED troffer panel, 4,400 lumens." },
    { name: "Smart Plug Wi-Fi", brand: "Voltix", uom: "PK", kg: 0.35, dims: [14, 10, 7], cost: 14.2, variants: ["2-Pack", "4-Pack"], desc: "Energy-monitoring smart plug, 15A, app & voice control." },
    { name: "Rugged Tablet 10in", brand: "Fieldcore", uom: "EA", kg: 0.92, dims: [30, 22, 5], cost: 412, storage: "high-value", desc: "IP65 Android tablet, 8GB/128GB, hot-swap battery." },
    { name: "Lithium Battery Pack AA", brand: "Voltix", uom: "PK", kg: 0.12, dims: [11, 8, 2], cost: 6.1, variants: ["8-Pack", "24-Pack"], storage: "hazmat", desc: "1.5V lithium AA cells, 20-year shelf life." },
    { name: "HDMI 2.1 Cable", brand: "Voltix", uom: "EA", kg: 0.15, dims: [14, 10, 3], cost: 5.2, variants: ["1m", "3m"], desc: "8K/60Hz certified ultra high speed HDMI cable." },
    { name: "Bluetooth Headset Mono", brand: "Fieldcore", uom: "EA", kg: 0.09, dims: [16, 10, 5], cost: 38, storage: "high-value", desc: "Noise-cancelling headset for warehouse voice picking." },
    { name: "Surge Protector 8-Outlet", brand: "Voltix", uom: "EA", kg: 0.9, dims: [36, 10, 6], cost: 17, desc: "2,700J surge strip with 2 USB-A ports, 3m cord." },
  ],
  "Power Tools": [
    { name: "Cordless Drill Driver 18V", brand: "Ironclad", uom: "EA", kg: 1.6, dims: [26, 24, 9], cost: 74, desc: "Brushless 2-speed drill driver, 60Nm torque, bare tool." },
    { name: "Impact Driver 20V", brand: "Ironclad", uom: "EA", kg: 1.3, dims: [22, 20, 8], cost: 82, desc: "3-speed brushless impact driver, 1/4in hex chuck." },
    { name: "Angle Grinder 125mm", brand: "Kestrel", uom: "EA", kg: 2.2, dims: [36, 14, 11], cost: 58, desc: "1,100W angle grinder with anti-restart protection." },
    { name: "Li-Ion Battery 5.0Ah", brand: "Ironclad", uom: "EA", kg: 0.68, dims: [12, 8, 7], cost: 46, storage: "hazmat", desc: "18V slide-pack battery with fuel gauge." },
    { name: "Circular Saw 185mm", brand: "Kestrel", uom: "EA", kg: 4.1, dims: [38, 30, 24], cost: 96, desc: "1,500W circular saw, 0–45° bevel, laser guide." },
    { name: "Orbital Sander 125mm", brand: "Kestrel", uom: "EA", kg: 1.4, dims: [24, 16, 16], cost: 39, desc: "Random orbital sander with dust extraction port." },
    { name: "Rotary Hammer SDS-Plus", brand: "Ironclad", uom: "EA", kg: 3.3, dims: [38, 26, 10], cost: 129, desc: "3-mode rotary hammer, 2.6J impact energy." },
    { name: "Drill Bit Set HSS 25pc", brand: "Kestrel", uom: "EA", kg: 0.9, dims: [20, 12, 4], cost: 19, desc: "Titanium coated HSS bits 1–13mm in metal case." },
    { name: "Fast Charger 18V", brand: "Ironclad", uom: "EA", kg: 0.6, dims: [18, 12, 8], cost: 34, desc: "Rapid charger for 18V slide-pack batteries." },
  ],
  "Industrial Supplies": [
    { name: "Nitrile Gloves", brand: "Guardline", uom: "BOX", kg: 0.6, dims: [24, 12, 9], cost: 7.8, variants: ["Size M", "Size L", "Size XL"], desc: "Powder-free 5mil nitrile gloves, 100 per box." },
    { name: "Safety Glasses Clear", brand: "Guardline", uom: "PK", kg: 0.4, dims: [20, 15, 10], cost: 18, desc: "ANSI Z87.1 anti-fog safety glasses, 12 per pack." },
    { name: "Hex Bolt M10x50 Zinc", brand: "Fastenco", uom: "BOX", kg: 4.2, dims: [18, 12, 10], cost: 21, desc: "Grade 8.8 zinc plated hex bolts, 100 per box." },
    { name: "Ratchet Strap 5m", brand: "Haulmark", uom: "EA", kg: 1.1, dims: [22, 18, 8], cost: 9.5, desc: "2,000kg break strength ratchet tie-down with J hooks." },
    { name: "Hi-Vis Safety Vest", brand: "Guardline", uom: "EA", kg: 0.18, dims: [30, 22, 2], cost: 4.2, variants: ["Yellow L", "Orange XL"], desc: "Class 2 reflective vest with zip front." },
    { name: "Industrial Absorbent Pads", brand: "Spillsorb", uom: "BOX", kg: 6.5, dims: [45, 45, 30], cost: 42, desc: "Universal absorbent pads 40x50cm, 100 per box." },
    { name: "Pallet Jack Wheel Kit", brand: "Haulmark", uom: "EA", kg: 5.4, dims: [30, 25, 15], cost: 68, desc: "Polyurethane load wheel replacement kit." },
    { name: "Cable Ties 300mm", brand: "Fastenco", uom: "PK", kg: 0.5, dims: [32, 8, 4], cost: 3.9, variants: ["Black", "Natural"], desc: "UV-stabilised nylon cable ties, 100 per pack." },
    { name: "Ear Defenders SNR 30", brand: "Guardline", uom: "EA", kg: 0.25, dims: [18, 14, 9], cost: 11, desc: "Over-head ear muffs, padded headband." },
    { name: "Steel Toe Boots", brand: "Guardline", uom: "EA", kg: 1.6, dims: [34, 22, 13], cost: 46, variants: ["UK 8", "UK 9", "UK 10"], desc: "S3 SRC safety boots, water resistant leather." },
    { name: "WD Lubricant Spray 400ml", brand: "Spillsorb", uom: "CS", kg: 5.8, dims: [26, 20, 22], cost: 36, storage: "hazmat", desc: "Multi-use penetrating lubricant, 12 cans per case." },
  ],
  Packaging: [
    { name: "Corrugated Box 40x30x30", brand: "Packwell", uom: "BOX", kg: 9.5, dims: [42, 32, 20], cost: 16, desc: "Single wall RSC shipping cartons, 25 per bundle." },
    { name: "Corrugated Box 60x40x40", brand: "Packwell", uom: "BOX", kg: 14, dims: [62, 42, 25], cost: 24, desc: "Double wall heavy duty cartons, 20 per bundle." },
    { name: "Stretch Film 500mm", brand: "Packwell", uom: "RL", kg: 2.4, dims: [50, 10, 10], cost: 11.5, desc: "23 micron cast stretch film, 300m roll." },
    { name: "Packing Tape 48mm", brand: "Packwell", uom: "CS", kg: 7.2, dims: [40, 30, 22], cost: 34, variants: ["Clear", "Brown"], desc: "Acrylic carton sealing tape, 36 rolls per case." },
    { name: "Bubble Wrap Roll 750mm", brand: "Cushionair", uom: "RL", kg: 3.1, dims: [76, 40, 40], cost: 19, desc: "Small bubble wrap, 100m perforated roll." },
    { name: "Void Fill Paper", brand: "Cushionair", uom: "BOX", kg: 11, dims: [40, 30, 30], cost: 27, desc: "Fanfold kraft void fill paper, 360m." },
    { name: "Shipping Labels 4x6", brand: "Scanlo", uom: "CS", kg: 5.8, dims: [32, 22, 18], cost: 29, desc: "Direct thermal labels, 500 per roll, 8 rolls." },
    { name: "Poly Mailer Bags 30x40", brand: "Packwell", uom: "PK", kg: 1.8, dims: [32, 22, 6], cost: 9.4, variants: ["100-Pack", "500-Pack"], desc: "Co-extruded self-seal mailers, 60 micron." },
    { name: "Pallet Corner Boards", brand: "Packwell", uom: "PK", kg: 8.5, dims: [120, 10, 10], cost: 18.5, desc: "Edge protectors 50x50x1200mm, 50 per pack." },
    { name: "Strapping Kit PP 12mm", brand: "Haulmark", uom: "EA", kg: 9.8, dims: [42, 42, 20], cost: 44, desc: "Polypropylene strapping 1000m with seals and tensioner." },
  ],
  "Home & Kitchen": [
    { name: "Stainless Cookware Set 10pc", brand: "Arbor & Co", uom: "EA", kg: 7.8, dims: [56, 32, 30], cost: 88, desc: "Tri-ply stainless cookware set, induction compatible." },
    { name: "Glass Food Containers", brand: "Arbor & Co", uom: "PK", kg: 3.2, dims: [36, 26, 16], cost: 22, variants: ["10-Piece", "18-Piece"], desc: "Borosilicate glass containers with locking lids." },
    { name: "Cotton Bath Towel", brand: "Linenly", uom: "EA", kg: 0.6, dims: [35, 25, 6], cost: 8.4, variants: ["White", "Slate", "Sage"], desc: "600 GSM combed cotton bath towel 70x140cm." },
    { name: "Cast Iron Skillet 30cm", brand: "Arbor & Co", uom: "EA", kg: 3.4, dims: [52, 32, 7], cost: 21, desc: "Pre-seasoned cast iron skillet with helper handle." },
    { name: "Electric Kettle 1.7L", brand: "Brevo", uom: "EA", kg: 1.3, dims: [24, 18, 26], cost: 23, desc: "Stainless steel kettle, 2,200W, auto shut-off." },
    { name: "Bamboo Cutting Board", brand: "Linenly", uom: "EA", kg: 1.1, dims: [45, 30, 3], cost: 9.8, desc: "Organic bamboo cutting board with juice groove." },
    { name: "Chef Knife 20cm", brand: "Arbor & Co", uom: "EA", kg: 0.35, dims: [34, 8, 3], cost: 18, desc: "German stainless steel chef knife, full tang." },
    { name: "Linen Duvet Cover Queen", brand: "Linenly", uom: "EA", kg: 1.2, dims: [38, 30, 8], cost: 34, variants: ["White", "Charcoal"], desc: "Stonewashed French linen duvet cover." },
    { name: "Air Fryer 5.5L", brand: "Brevo", uom: "EA", kg: 5.2, dims: [38, 34, 36], cost: 52, desc: "1,700W digital air fryer with 8 presets." },
  ],
  "Health & Beauty": [
    { name: "Hand Sanitizer 500ml", brand: "Purelle", uom: "CS", kg: 7, dims: [30, 22, 22], cost: 26, storage: "hazmat", desc: "70% ethanol gel sanitizer, 12 bottles per case." },
    { name: "Vitamin D3 2000IU", brand: "Nutrive", uom: "EA", kg: 0.12, dims: [6, 6, 11], cost: 4.6, desc: "120 softgels, cholecalciferol, gluten free." },
    { name: "SPF 50 Sunscreen 200ml", brand: "Solenne", uom: "EA", kg: 0.24, dims: [6, 4, 18], cost: 5.9, desc: "Broad spectrum water resistant sunscreen lotion." },
    { name: "Electric Toothbrush", brand: "Brightline", uom: "EA", kg: 0.4, dims: [24, 9, 6], cost: 27, desc: "Sonic toothbrush with 2-minute timer and travel case." },
    { name: "First Aid Kit Workplace", brand: "Guardline", uom: "EA", kg: 1.9, dims: [32, 24, 10], cost: 31, desc: "BS 8599-1 medium workplace first aid kit." },
    { name: "Shampoo Argan Oil 400ml", brand: "Solenne", uom: "CS", kg: 5.4, dims: [28, 20, 22], cost: 33, desc: "Sulfate-free shampoo, 12 bottles per case." },
    { name: "Disposable Face Masks", brand: "Guardline", uom: "BOX", kg: 0.32, dims: [19, 10, 9], cost: 3.2, variants: ["50-Pack", "100-Pack"], desc: "3-ply Type IIR surgical face masks." },
    { name: "Moisturising Hand Cream", brand: "Solenne", uom: "CS", kg: 3.6, dims: [24, 18, 14], cost: 24, desc: "75ml shea butter hand cream, 24 per case." },
    { name: "Digital Thermometer", brand: "Brightline", uom: "EA", kg: 0.05, dims: [14, 4, 2], cost: 3.8, desc: "Fast-read oral/underarm digital thermometer." },
  ],
  "Food & Beverage": [
    { name: "Sparkling Water 500ml", brand: "Clearbrook", uom: "CS", kg: 12.8, dims: [40, 27, 22], cost: 7.2, variants: ["Lemon", "Natural"], desc: "Mineral sparkling water, 24 bottles per case." },
    { name: "Arabica Coffee Beans 1kg", brand: "Highland Roast", uom: "EA", kg: 1.05, dims: [24, 14, 8], cost: 13.5, desc: "Medium roast single origin whole bean coffee." },
    { name: "Greek Yogurt 500g", brand: "Alpenmilk", uom: "CS", kg: 6.4, dims: [36, 24, 12], cost: 14.8, storage: "chilled", desc: "Strained plain yogurt 10% fat, 12 tubs per case." },
    { name: "Fresh Orange Juice 1L", brand: "Clearbrook", uom: "CS", kg: 6.6, dims: [30, 20, 26], cost: 11.6, storage: "chilled", desc: "Cold-pressed not-from-concentrate, 6 per case." },
    { name: "Organic Rolled Oats 1kg", brand: "Greenfield", uom: "CS", kg: 6.2, dims: [38, 26, 20], cost: 15.4, desc: "Whole grain rolled oats, 6 bags per case." },
    { name: "Aged Cheddar Block 2kg", brand: "Alpenmilk", uom: "EA", kg: 2.05, dims: [28, 10, 10], cost: 17.9, storage: "chilled", desc: "12-month aged mature cheddar, vacuum packed." },
    { name: "Energy Bar Variety", brand: "Greenfield", uom: "BOX", kg: 1.4, dims: [26, 18, 8], cost: 12.2, desc: "Assorted protein bars, 24 bars per box." },
    { name: "Green Tea Bags 100ct", brand: "Highland Roast", uom: "CS", kg: 2.4, dims: [34, 24, 16], cost: 19, desc: "Japanese sencha tea bags, 12 boxes per case." },
    { name: "Olive Oil Extra Virgin 1L", brand: "Greenfield", uom: "CS", kg: 11, dims: [30, 20, 30], cost: 48, desc: "Cold-extracted EVOO, 12 bottles per case." },
    { name: "Frozen Berry Mix 1kg", brand: "Alpenmilk", uom: "CS", kg: 10.4, dims: [40, 30, 20], cost: 27, storage: "chilled", desc: "IQF strawberries, blueberries and raspberries, 10 bags." },
    { name: "Butter Unsalted 250g", brand: "Alpenmilk", uom: "CS", kg: 5.2, dims: [30, 20, 12], cost: 21, storage: "chilled", desc: "Churned cream butter, 20 blocks per case." },
  ],
  Automotive: [
    { name: "Synthetic Motor Oil 5W-30 5L", brand: "Duramax", uom: "EA", kg: 4.6, dims: [26, 14, 32], cost: 24, storage: "hazmat", desc: "Full synthetic API SP engine oil." },
    { name: "Wiper Blade 24in", brand: "Clearview", uom: "EA", kg: 0.3, dims: [64, 8, 4], cost: 7.5, desc: "Beam-style all-season wiper blade with adapters." },
    { name: "Brake Pad Set Front", brand: "Stopwell", uom: "EA", kg: 2.3, dims: [20, 16, 8], cost: 32, desc: "Ceramic brake pads with hardware kit." },
    { name: "Car Battery 70Ah", brand: "Duramax", uom: "EA", kg: 17.5, dims: [28, 18, 19], cost: 98, storage: "hazmat", desc: "Maintenance-free AGM start-stop battery." },
    { name: "Air Filter Panel", brand: "Stopwell", uom: "EA", kg: 0.4, dims: [30, 22, 6], cost: 8.9, desc: "OEM-grade engine air filter element." },
    { name: "Coolant Antifreeze 5L", brand: "Duramax", uom: "EA", kg: 5.4, dims: [28, 14, 30], cost: 15, storage: "hazmat", desc: "OAT long-life coolant, -36°C protection." },
    { name: "Spark Plug Iridium", brand: "Stopwell", uom: "PK", kg: 0.2, dims: [12, 10, 4], cost: 21, desc: "Iridium tip spark plugs, 4 per pack." },
    { name: "Tyre Inflator 12V", brand: "Clearview", uom: "EA", kg: 1.4, dims: [22, 18, 10], cost: 29, desc: "Digital compressor with auto shut-off, 10 bar." },
  ],
  "Office Supplies": [
    { name: "Copy Paper A4 80gsm", brand: "Meridian", uom: "CS", kg: 12.5, dims: [30, 22, 28], cost: 21, desc: "Premium white copy paper, 5 reams per case." },
    { name: "Ergonomic Office Chair", brand: "Northline", uom: "EA", kg: 18, dims: [70, 62, 40], cost: 145, desc: "Mesh back task chair with adjustable lumbar support." },
    { name: "Gel Pen Black 0.7mm", brand: "Meridian", uom: "BOX", kg: 0.35, dims: [16, 10, 5], cost: 6.4, desc: "Retractable gel ink pens, 12 per box." },
    { name: "Archive Storage Box", brand: "Northline", uom: "PK", kg: 3.6, dims: [44, 34, 8], cost: 14, desc: "Flat-packed archive boxes with lids, 10 per pack." },
    { name: "Whiteboard 120x90", brand: "Northline", uom: "EA", kg: 9.2, dims: [124, 94, 4], cost: 56, desc: "Magnetic dry-erase whiteboard, aluminium frame." },
    { name: "Sticky Notes 76x76", brand: "Meridian", uom: "PK", kg: 0.9, dims: [20, 16, 8], cost: 7.6, desc: "Assorted neon sticky notes, 12 pads." },
    { name: "Height Adjustable Desk", brand: "Northline", uom: "EA", kg: 32, dims: [140, 72, 16], cost: 268, desc: "Dual-motor sit-stand desk frame and top 140x70." },
    { name: "Laser Toner Cartridge", brand: "Meridian", uom: "EA", kg: 1.1, dims: [38, 14, 14], cost: 62, storage: "high-value", desc: "High-yield black toner, 9,000 pages." },
    { name: "Lever Arch File A4", brand: "Meridian", uom: "BOX", kg: 6.4, dims: [32, 29, 40], cost: 14, desc: "75mm polypropylene lever arch files, 10 per box." },
  ],
};

const CAT_PREFIX: Record<Category, string> = {
  Electronics: "ELC",
  "Power Tools": "PWT",
  "Industrial Supplies": "IND",
  Packaging: "PKG",
  "Home & Kitchen": "HMK",
  "Health & Beauty": "HLB",
  "Food & Beverage": "FNB",
  Automotive: "AUT",
  "Office Supplies": "OFC",
};

/** Valid EAN-13 with check digit. */
function ean13(base12: string) {
  const digits = base12.split("").map(Number);
  const sum = digits.reduce((s, d, i) => s + d * (i % 2 === 0 ? 1 : 3), 0);
  return base12 + ((10 - (sum % 10)) % 10);
}

export function generateProducts(supplierIdsByCategory: Record<Category, string[]>, supplierByBrand: Record<string, string> = {}): Product[] {
  const rng = createRng(1042);
  const products: Product[] = [];
  let seq = 10000;
  (Object.keys(T) as Category[]).forEach((category) => {
    T[category].forEach((t) => {
      const variants = t.variants ?? [undefined];
      variants.forEach((variant) => {
        seq += rng.int(7, 61);
        const sku = `${CAT_PREFIX[category]}-${seq}${variant ? "-" + variant.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() : ""}`;
        const velocity = rng.weighted<[number, number]>([
          [[40, 120], 3],
          [[120, 400], 5],
          [[400, 1200], 2],
        ]);
        const minStock = Math.round(rng.int(velocity[0], velocity[1]) / 10) * 10;
        const maxStock = minStock * rng.int(4, 7);
        const created = new Date(REFERENCE_NOW.getTime() - rng.int(60, 900) * 86400000);
        const updated = new Date(REFERENCE_NOW.getTime() - rng.int(0, 45) * 86400000 - rng.int(0, 86400000));
        const suppliers = supplierIdsByCategory[category];
        products.push({
          id: `prd_${seq}`,
          sku,
          name: variant ? `${t.name} — ${variant}` : t.name,
          barcode: ean13(`0${rng.int(10000, 99999)}${String(seq).padStart(6, "0")}`.slice(0, 12)),
          category,
          brand: t.brand,
          description: t.desc,
          uom: t.uom,
          unitsPerCase: t.uom === "EA" ? rng.pick([1, 4, 6, 12]) : 1,
          weightKg: t.kg,
          dimensions: { length: t.dims[0], width: t.dims[1], height: t.dims[2] },
          minStock,
          maxStock,
          reorderQty: Math.round((maxStock - minStock) / 10) * 10,
          supplierId: supplierByBrand[t.brand] ?? suppliers[rng.int(0, suppliers.length - 1)],
          unitCost: t.cost,
          unitPrice: Number((t.cost * rng.float(1.35, 1.9)).toFixed(2)),
          storage: t.storage ?? "ambient",
          status: rng.weighted([
            ["active", 30],
            ["draft", 1],
            ["discontinued", 1],
          ]),
          createdAt: created.toISOString(),
          updatedAt: updated.toISOString(),
        });
      });
    });
  });
  return products;
}
