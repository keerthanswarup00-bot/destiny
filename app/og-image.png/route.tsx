import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const imageUrl = new URL("/images/hero.png", request.url).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          color: "#101010",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "1200px",
            height: "430px",
            display: "flex",
            overflow: "hidden",
          }}
        >
          <img
            src={imageUrl}
            alt=""
            width="1200"
            height="430"
            style={{
              width: "1200px",
              height: "430px",
              objectFit: "cover",
              objectPosition: "center 42%",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background: "linear-gradient(180deg, rgba(0,0,0,0.02) 35%, rgba(0,0,0,0.38) 100%)",
            }}
          />
        </div>

        <div
          style={{
            height: "200px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 58px",
            borderTop: "1px solid #e8e6df",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "42px",
              fontWeight: 600,
              letterSpacing: "-1.5px",
            }}
          >
            DESTINY
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "8px",
              fontSize: "19px",
              fontWeight: 500,
              letterSpacing: "5px",
              color: "#777777",
            }}
          >
            EVENTS + PHOTOGRAPHY
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "18px",
              fontSize: "17px",
              color: "#777777",
            }}
          >
            Stories, moments, captured with intention.
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    },
  );
}
