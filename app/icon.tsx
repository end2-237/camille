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
          borderRadius: 8,
          background: "#0a0a00",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(212,175,55,0.5)",
        }}
      >
        <span
          style={{
            fontFamily: "Blackout",
            fontSize: 22,
            color: "#D4AF37",
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
