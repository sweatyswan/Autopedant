# Project Goal
Build the complete interactive frontend for a vehicle repair tracking and workshop CRM application ("Zdravotná karta vozidla"). The primary user is an auto mechanic who requires frictionless, keyboard-friendly data entry, clear financial tracking (cost vs. sell price vs. net profit), and historical search by license plate (EČV) or VIN.

# Tech Stack & Guidelines
- Framework: Next.js (App Router), React, TypeScript, Tailwind CSS
- Design System: Adhere strictly to the rules defined in `.cursorrules` (Dark theme, sharp corners, red accents, Shadcn UI components, Lucide icons).
- Localization: All UI copy, labels, and placeholders must be in professional Slovak.

# TypeScript Data Architecture
Define and utilize these core data structures:

```typescript
export type Vehicle = {
  id: string;
  licensePlate: string; // EČV (e.g. "BA-123XY" or "ZH-456AB")
  vin: string;
  makeModel: string;
  year: number;
  customerId: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
};

export type ServiceActionType = 'Výmena' | 'Oprava' | 'Kontrola' | 'Nastavenie';

export type ServiceCategory = 
  | 'Údržba a náplne' 
  | 'Brzdový systém' 
  | 'Podvozok a riadenie' 
  | 'Motor a pohon' 
  | 'Elektrika a diagnostika' 
  | 'Klimatizácia a chladenie' 
  | 'Karoséria a interiér';

export type ServiceItem = {
  id: string;
  category: ServiceCategory;
  actionType: ServiceActionType;
  partName: string;
  purchasePrice: number; // Nákupná cena dielu
  sellPrice: number;     // Predajná cena pre zákazníka
};

export type ServiceRecord = {
  id: string;
  vehicleId: string;
  serviceDate: string;   // ISO format YYYY-MM-DD
  mileage: number;       // Stav tachometra v km
  laborCost: number;     // Cena za prácu účtovaná zákazníkovi
  mechanicNotes: string; // Poznámka / zistené závady
  items: ServiceItem[];
};