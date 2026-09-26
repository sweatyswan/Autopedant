import { Suspense } from "react"

import { VehicleScreen } from "@/components/workshop/vehicle-screen"

export default function VehiclePage() {
  return (
    <Suspense>
      <VehicleScreen />
    </Suspense>
  )
}
