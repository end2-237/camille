import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const font = await readFile(join(process.cwd(), "public/fonts/blackout/Blackout.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: "#16141A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(124,90,248,0.55)",
        }}
      >
        <span
          style={{
            fontFamily: "Blackout",
            fontSize: 22,
            color: "#8E6BFA",
            lineHeight: 1,
            marginTop: 2,
          }}
        >
          C
        </span>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Blackout", data: font, style: "normal" }],
    }
  );
}
