import axios from "axios";
import express from "express";
import config from "./config";
import sharp from "sharp";

export function init() {
  console.log("Starting backend.");

  const app = express();
  app.use(express.static(process.cwd() + "/dist"));
  app.get("/proxy", async (req, res) => {
    const url = String(req.query.url);
    if (!url) return res.sendStatus(200);
    const type = String(req.query.t) as "image";
    try {
      switch (type) {
        case "image": {
          const data = await axios.get(url, {
            responseType: "arraybuffer",
          });
          const img = {
            type: data.headers["content-type"],
            buffer: Buffer.from(data.data, "binary"),
          };
          if (img.type == "image/webp") {
            img.type = "image/png";
            img.buffer = await sharp(img.buffer).png().toBuffer();
          }
          return res.contentType(img.type).end(img.buffer);
        }
        default: {
          return res.sendStatus(200);
        }
      }
    } catch (err) {
      try {
        console.error(err);
        return res.sendStatus(200);
      } catch {}
    }
  });
  app.get("*", (req, res) => {
    res.sendFile(process.cwd() + "/dist/index.html");
  });
  app.listen(config.port, () => {
    console.log(`Listening on port ${config.port}.`);
  });
}
