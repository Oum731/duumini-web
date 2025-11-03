import sharp from "sharp";
import { mkdir } from "fs/promises";

await mkdir("public/icons", { recursive: true });

// Source = logo Duumini noir
const src = "public/logo.png"; // ← copie ton fichier ici

await sharp(src)
  .resize(192, 192)
  .png({ quality: 100 })
  .toFile("public/icons/icon-192x192.png");

await sharp(src)
  .resize(512, 512)
  .png({ quality: 100 })
  .toFile("public/icons/icon-512x512.png");

console.log("✅ Icônes générées :");
console.log(" - public/icons/icon-192x192.png");
console.log(" - public/icons/icon-512x512.png");
