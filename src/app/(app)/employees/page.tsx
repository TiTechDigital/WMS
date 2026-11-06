import type { Metadata } from "next";
import { EmployeesView } from "@/components/modules/employees/employees-view";

export const metadata: Metadata = { title: "Employees & Operators" };

export default function Page() {
  return <EmployeesView />;
}
