import { VehicleScreen } from "@/components/workshop/vehicle-screen"
import { seedData } from "@/lib/seed"

export function generateStaticParams() {
  return seedData.vehicles.map((vehicle) => ({ id: vehicle.id }))
}

export default function VehiclePage() {
  return <VehicleScreen />
}
