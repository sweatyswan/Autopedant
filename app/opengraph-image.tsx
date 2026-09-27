import { ImageResponse } from "next/og"

export const alt = "Autopedant | Prehľad servisovaných vozidiel"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const dynamic = "force-static"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#000000",
              letterSpacing: -1,
            }}
          >
            Autopedant
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 500,
              color: "#525252",
            }}
          >
            Prehľad servisovaných vozidiel
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 24,
            color: "#095A7C",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#159DD4",
            }}
          />
          Servisná evidencia dielne
        </div>
      </div>
    ),
    size
  )
}
