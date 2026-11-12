import type { Employee, EmployeeRole } from "@/types";
import { createRng } from "@/lib/random";
import { currentTime, WAREHOUSES } from "@/lib/constants";

const NAMES = [
  "Marcus Reed", "Ana Gutierrez", "Tyrone Banks", "Emily Novak", "Jamal Carter", "Sofia Petrova", "Luis Hernandez",
  "Grace Kim", "Darnell Hayes", "Megan O'Connor", "Hector Morales", "Aisha Bello", "Ethan Brooks", "Kayla Foster",
  "Omar Haddad", "Rosa Delgado", "Victor Nguyen", "Brianna Scott", "Isaac Turner", "Leah Goldberg", "Andre Mitchell",
  "Natalie Chen", "Carlos Ramirez", "Destiny Ward", "Patrick Flynn", "Yuki Tanaka", "Malik Johnson", "Olga Ivanova",
  "Trevor Lane", "Fatima Rahman", "Samuel Ortiz", "Chloe Bennett", "Devon Price", "Mariana Silva", "Kenji Watanabe",
  "Lauren Hughes", "Rashad Coleman", "Tessa Lindgren", "Javier Castillo", "Priya Desai", "Noah Fischer", "Bianca Rossi",
  "Curtis Long", "Imani Brooks", "Ricardo Alves", "Hannah Ward", "Desmond Okafor", "Elena Sokolova",
];

const ROLE_MIX: [EmployeeRole, number][] = [
  ["Picker", 9],
  ["Packer", 4],
  ["Receiver", 3],
  ["Forklift Operator", 3],
  ["Inventory Controller", 2],
  ["Shift Supervisor", 1.4],
];

const CERTS: Record<EmployeeRole, string[]> = {
  Picker: ["RF Scanner", "Voice Picking", "Hazmat Awareness"],
  Packer: ["Hazmat Awareness", "Cartonization", "Parcel Systems"],
  Receiver: ["Quality Inspection", "RF Scanner", "Cold Chain"],
  "Forklift Operator": ["Counterbalance FLT", "Reach Truck", "Order Picker"],
  "Inventory Controller": ["Cycle Counting", "WMS Super User", "RF Scanner"],
  "Shift Supervisor": ["First Aid", "WMS Super User", "Lean Six Sigma Yellow"],
  "Warehouse Manager": ["OSHA 30", "WMS Admin", "Lean Six Sigma Green"],
};

const ZONES_BY_ROLE: Record<EmployeeRole, string[]> = {
  Picker: ["Zone A", "Zone A", "Zone B", "Zone D"],
  Packer: ["Pack Station"],
  Receiver: ["Receiving"],
  "Forklift Operator": ["Zone B", "Zone C"],
  "Inventory Controller": ["Zone A", "Zone B", "All Zones"],
  "Shift Supervisor": ["All Zones"],
  "Warehouse Manager": ["All Zones"],
};

export function generateEmployees(): Employee[] {
  const rng = createRng(5150);
  const out: Employee[] = [];
  let n = 0;
  WAREHOUSES.forEach((wh, wi) => {
    const count = wi === 0 ? 30 : 9;
    for (let i = 0; i < count; i++) {
      const name = NAMES[n % NAMES.length];
      const role: EmployeeRole = i === 0 ? "Warehouse Manager" : rng.weighted(ROLE_MIX);
      const shift = rng.weighted<Employee["shift"]>([["Morning", 5], ["Afternoon", 3], ["Night", 2]]);
      const status: Employee["status"] =
        shift === "Morning" ? rng.weighted([["on_shift", 8], ["on_break", 1.5]]) : shift === "Afternoon" ? rng.weighted([["off_shift", 6], ["on_shift", 1]]) : "off_shift";
      const isFloor = ["Picker", "Packer", "Receiver", "Forklift Operator"].includes(role);
      out.push({
        id: `emp_${300 + n}`,
        badge: `${wh.id.slice(3)}-${String(1040 + n * 3)}`,
        name,
        email: `${name.toLowerCase().replace(/[^a-z ]/g, "").replace(" ", ".")}@northstar-logistics.com`,
        role,
        warehouseId: wh.id,
        shift,
        zone: rng.pick(ZONES_BY_ROLE[role]),
        status: n % 23 === 7 ? "on_leave" : status,
        unitsPerHour: isFloor ? rng.int(role === "Picker" ? 95 : 60, role === "Picker" ? 165 : 120) : 0,
        accuracy: rng.float(97.2, 99.95, 2),
        tasksToday: status === "on_shift" || status === "on_break" ? (isFloor ? rng.int(6, 38) : rng.int(2, 12)) : 0,
        certifications: rng.shuffle(CERTS[role]).slice(0, rng.int(1, 3)),
        device: isFloor ? `RF-${rng.int(100, 299)}` : undefined,
        hiredAt: new Date(currentTime().getTime() - rng.int(40, 2900) * 86400000).toISOString(),
      });
      n++;
    }
  });
  return out;
}
