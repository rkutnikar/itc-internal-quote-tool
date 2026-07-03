import type { DirectoryCustomer, DirectoryEmployee, DirectorySupplier } from "./directory";

/**
 * Sample directory used until Frappe is connected, so the whole quote flow
 * can be exercised end-to-end. Marked source:"mock" everywhere in the UI.
 */

export const mockEmployees: DirectoryEmployee[] = [
  { id: "HR-EMP-00001", name: "Ananya Sharma", designation: "Senior Consultant", ctcAnnual: 2_400_000, monthlyCost: 200_000 },
  { id: "HR-EMP-00002", name: "Vikram Iyer", designation: "Principal Architect", ctcAnnual: 4_200_000, monthlyCost: 350_000 },
  { id: "HR-EMP-00003", name: "Priya Nair", designation: "Consultant", ctcAnnual: 1_500_000, monthlyCost: 125_000 },
  { id: "HR-EMP-00004", name: "Rohan Mehta", designation: "Lead Data Engineer", ctcAnnual: 3_000_000, monthlyCost: 250_000 },
  { id: "HR-EMP-00005", name: "Sneha Kulkarni", designation: "Business Analyst", ctcAnnual: 1_200_000, monthlyCost: 100_000 },
  { id: "HR-EMP-00006", name: "Arjun Reddy", designation: "DevOps Specialist", ctcAnnual: 2_100_000, monthlyCost: 175_000 },
  { id: "HR-EMP-00007", name: "Kavita Desai", designation: "Program Manager", ctcAnnual: 3_600_000, monthlyCost: 300_000 },
  { id: "HR-EMP-00008", name: "Imran Khan", designation: "Security Consultant", ctcAnnual: 2_700_000, monthlyCost: null }, // CTC missing on purpose (E1)
];

export const mockCustomers: DirectoryCustomer[] = [
  { id: "CUST-0001", name: "Meridian Retail Group", priorityRaw: "P1 - Strategic", priorityKey: "p1" },
  { id: "CUST-0002", name: "Halcyon Financial Services", priorityRaw: "P1 - Strategic", priorityKey: "p1" },
  { id: "CUST-0003", name: "Bluegrove Manufacturing", priorityRaw: "P2 - Preferred", priorityKey: "p2" },
  { id: "CUST-0004", name: "Northwind Logistics", priorityRaw: "P2 - Preferred", priorityKey: "p2" },
  { id: "CUST-0005", name: "Caldera Health Systems", priorityRaw: "P3 - Standard", priorityKey: "p3" },
  { id: "CUST-0006", name: "Argent Media Works", priorityRaw: "P3 - Standard", priorityKey: "p3" },
];

export const mockSuppliers: DirectorySupplier[] = [
  { id: "SUP-0001", name: "Quantia Consulting LLP", monthlyRate: 280_000 },
  { id: "SUP-0002", name: "Sattva Tech Partners", monthlyRate: 220_000 },
  { id: "SUP-0003", name: "Orbit Staffing Solutions", monthlyRate: 190_000 },
  { id: "SUP-0004", name: "Everest IT Services", monthlyRate: null }, // rate missing on purpose (E4)
];
