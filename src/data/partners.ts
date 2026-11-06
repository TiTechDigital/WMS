import type { Category, Customer, CustomerType, SlaTier, Supplier } from "@/types";
import { CATEGORIES } from "@/types";
import { createRng } from "@/lib/random";

const SUPPLIERS: [string, string, string, string, Category[]][] = [
  ["Voltix Components Ltd.", "Shenzhen", "China", "Mei Lin Zhao", ["Electronics"]],
  ["Scanlo Systems Inc.", "San Jose", "United States", "Derek Holloway", ["Electronics", "Packaging"]],
  ["Fieldcore Devices", "Austin", "United States", "Priya Raman", ["Electronics"]],
  ["Lumora Lighting GmbH", "Stuttgart", "Germany", "Jonas Weber", ["Electronics"]],
  ["Ironclad Tool Company", "Milwaukee", "United States", "Rachel Brennan", ["Power Tools"]],
  ["Kestrel Industrial", "Taichung", "Taiwan", "Kevin Huang", ["Power Tools", "Industrial Supplies"]],
  ["Guardline Safety Supply", "Charlotte", "United States", "Marcus Bell", ["Industrial Supplies", "Health & Beauty"]],
  ["Fastenco Fasteners", "Cleveland", "United States", "Anita Kowalski", ["Industrial Supplies"]],
  ["Haulmark Logistics Gear", "Memphis", "United States", "Tom Whitaker", ["Industrial Supplies", "Packaging"]],
  ["Packwell Packaging Co.", "Atlanta", "United States", "Laura Jennings", ["Packaging"]],
  ["Cushionair Protective", "Monterrey", "Mexico", "Luis Ortega", ["Packaging"]],
  ["Arbor & Co Housewares", "Portland", "United States", "Hannah Cole", ["Home & Kitchen"]],
  ["Linenly Textiles", "Izmir", "Turkey", "Elif Demir", ["Home & Kitchen"]],
  ["Brevo Appliances", "Ningbo", "China", "Wei Chen", ["Home & Kitchen"]],
  ["Solenne Beauty Labs", "Lyon", "France", "Camille Laurent", ["Health & Beauty"]],
  ["Nutrive Health", "Salt Lake City", "United States", "Grant Peterson", ["Health & Beauty", "Food & Beverage"]],
  ["Clearbrook Beverages", "Asheville", "United States", "Olivia Grant", ["Food & Beverage"]],
  ["Alpenmilk Dairy Co-op", "Madison", "United States", "Erik Lindqvist", ["Food & Beverage"]],
  ["Greenfield Organics", "Fresno", "United States", "Sofia Martinez", ["Food & Beverage"]],
  ["Highland Roast Traders", "Medellín", "Colombia", "Andrés Restrepo", ["Food & Beverage"]],
  ["Duramax Automotive", "Detroit", "United States", "Brian McCarthy", ["Automotive"]],
  ["Stopwell Parts", "Toledo", "United States", "Nina Patel", ["Automotive"]],
  ["Meridian Office Supply", "Columbus", "United States", "Daniel Foster", ["Office Supplies"]],
  ["Northline Furniture", "Grand Rapids", "United States", "Megan Doyle", ["Office Supplies"]],
];

export function generateSuppliers(): Supplier[] {
  const rng = createRng(77);
  return SUPPLIERS.map(([name, city, country, contact, categories], i) => {
    const slug = name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
    return {
      id: `sup_${100 + i}`,
      code: `SUP-${String(1001 + i * 7)}`,
      name,
      contactName: contact,
      email: `${contact.split(" ")[0].toLowerCase()}@${slug}.com`,
      phone: country === "United States" ? `+1 (${rng.int(200, 989)}) ${rng.int(200, 989)}-${rng.int(1000, 9999)}` : `+${rng.int(30, 90)} ${rng.int(100, 999)} ${rng.int(100, 999)} ${rng.int(1000, 9999)}`,
      city,
      country,
      leadTimeDays: country === "United States" ? rng.int(2, 9) : rng.int(18, 42),
      onTimeRate: rng.float(82, 99.4, 1),
      qualityScore: rng.float(90, 99.8, 1),
      openPOs: rng.int(0, 9),
      spendYtd: rng.int(48, 1900) * 1000,
      categories,
      paymentTerms: rng.pick(["Net 30", "Net 45", "Net 60", "2/10 Net 30"]),
      status: i === 13 ? "on_hold" : i === 21 ? "inactive" : "active",
    };
  });
}

export function supplierIdsByCategory(suppliers: Supplier[]): Record<Category, string[]> {
  const map = Object.fromEntries(CATEGORIES.map((c) => [c, [] as string[]])) as Record<Category, string[]>;
  suppliers.forEach((s) => s.categories.forEach((c) => map[c].push(s.id)));
  return map;
}

const CUSTOMERS: [string, CustomerType, string, string, string, string][] = [
  ["Northwind Retail Group", "Retail", "Chicago", "IL", "60607", "1120 W Fulton Market"],
  ["Peakline Outdoor Stores", "Retail", "Denver", "CO", "80202", "1701 Wynkoop St"],
  ["BrightCart Online", "E-commerce", "Seattle", "WA", "98109", "400 Fairview Ave N"],
  ["Harbor Hardware Supply", "Wholesale", "Savannah", "GA", "31401", "22 Bay St"],
  ["Summit Medical Distributors", "Distributor", "Nashville", "TN", "37203", "901 Division St"],
  ["UrbanNest Home", "E-commerce", "Brooklyn", "NY", "11201", "55 Water St"],
  ["Coastal Foodservice", "Distributor", "Jacksonville", "FL", "32202", "301 W Bay St"],
  ["Redline Auto Parts", "Retail", "Houston", "TX", "77002", "1200 Smith St"],
  ["Keystone Facilities Mgmt", "Wholesale", "Philadelphia", "PA", "19103", "1650 Market St"],
  ["Evergreen Grocers", "Retail", "Portland", "OR", "97209", "1015 NW Couch St"],
  ["Atlas Office Solutions", "Wholesale", "Charlotte", "NC", "28202", "101 S Tryon St"],
  ["Lumen & Loft", "E-commerce", "Austin", "TX", "78701", "500 W 2nd St"],
  ["Pioneer Construction Supply", "Wholesale", "Phoenix", "AZ", "85004", "2 N Central Ave"],
  ["FreshWay Markets", "Retail", "Orlando", "FL", "32801", "200 S Orange Ave"],
  ["MetroCare Pharmacies", "Retail", "Atlanta", "GA", "30303", "191 Peachtree St NE"],
  ["Vantage Industrial", "Distributor", "Birmingham", "AL", "35203", "1901 6th Ave N"],
  ["Cascade Living", "E-commerce", "Boise", "ID", "83702", "800 W Main St"],
  ["Granite State Supply", "Wholesale", "Manchester", "NH", "03101", "1000 Elm St"],
  ["Sunbelt Restaurant Group", "Distributor", "Tampa", "FL", "33602", "400 N Ashley Dr"],
  ["Riverbend Hardware", "Retail", "Memphis", "TN", "38103", "100 Peabody Pl"],
  ["Polaris Fleet Services", "Wholesale", "Dallas", "TX", "75201", "1601 Elm St"],
  ["Marketplace Direct", "E-commerce", "Las Vegas", "NV", "89101", "300 S 4th St"],
  ["Ozark Farm & Home", "Retail", "Springfield", "MO", "65806", "300 S Jefferson Ave"],
  ["Bayview Hospitality", "Distributor", "San Diego", "CA", "92101", "600 W Broadway"],
  ["Ironwood Contractors", "Wholesale", "Salt Lake City", "UT", "84101", "222 S Main St"],
  ["Willow & Wren", "E-commerce", "Nashville", "TN", "37206", "1006 Fatherland St"],
  ["Capitol Schools Purchasing", "Wholesale", "Raleigh", "NC", "27601", "333 Fayetteville St"],
  ["Gulf Coast Marine", "Retail", "Mobile", "AL", "36602", "41 W I-65 Service Rd"],
];

const FIRST = ["James", "Maria", "Robert", "Linda", "Michael", "Sarah", "David", "Karen", "Chris", "Jessica", "Daniel", "Emily", "Kevin", "Ashley", "Brian", "Nicole", "Jason", "Rebecca", "Ryan", "Laura"];
const LAST = ["Johnson", "Garcia", "Miller", "Davis", "Rodriguez", "Wilson", "Anderson", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris", "Clark", "Lewis", "Walker", "Young", "Allen"];

export function generateCustomers(): Customer[] {
  const rng = createRng(311);
  return CUSTOMERS.map(([name, type, city, state, zip, line1], i) => {
    const contact = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    const domain = name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
    const tier: SlaTier = i % 5 === 0 ? "Platinum" : i % 3 === 0 ? "Gold" : "Standard";
    return {
      id: `cus_${200 + i}`,
      code: `CUS-${String(2400 + i * 13)}`,
      name,
      type,
      contactName: contact,
      email: `${contact.split(" ")[0].toLowerCase()}.${contact.split(" ")[1].toLowerCase()}@${domain}.com`,
      phone: `+1 (${rng.int(200, 989)}) ${rng.int(200, 989)}-${rng.int(1000, 9999)}`,
      address: { line1, city, state, postalCode: zip, country: "US" },
      slaTier: tier,
      ordersYtd: rng.int(40, 1400),
      revenueYtd: rng.int(60, 4200) * 1000,
      onTimeDelivery: rng.float(88, 99.6, 1),
      status: i === 17 ? "credit_hold" : i === 26 ? "inactive" : "active",
    };
  });
}

export const PERSON_NAMES = { FIRST, LAST };

/** Map product brands to their manufacturer-supplier where the names match (e.g. "Voltix" → Voltix Components). */
export function supplierIdsByBrand(suppliers: Supplier[]): Record<string, string> {
  const map: Record<string, string> = {};
  suppliers.forEach((s) => {
    const first = s.name.split(" ")[0];
    map[first] = s.id;
    if (s.name.startsWith("Arbor & Co")) map["Arbor & Co"] = s.id;
    if (s.name.startsWith("Highland Roast")) map["Highland Roast"] = s.id;
  });
  return map;
}
