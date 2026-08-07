import { initializeApp, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import * as fs from "fs";
import * as path from "path";

// Cloud Storage からローカルの functions/assets ディレクトリへ一括ダウンロード
async function downloadAllAssets() {
  // Application Default Credentials または Firebase Admin 初期化
  initializeApp({
    projectId: "personal-value-card-game",
    storageBucket: "personal-value-card-game.firebasestorage.app",
  });

  const bucket = getStorage().bucket();
  const targetDir = path.resolve(__dirname, "../assets");

  console.log("Fetching files from Firebase Storage...");
  const [files] = await bucket.getFiles({ prefix: "assets/" });

  console.log(`Found ${files.length} files to download.`);

  for (const file of files) {
    if (file.name.endsWith("/")) continue;

    // file.name: "assets/cards/temporary/card_00.png"
    // relativePath: "cards/temporary/card_00.png"
    const relativePath = file.name.replace(/^assets\//, "");
    const destPath = path.join(targetDir, relativePath);

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    console.log(`Downloading: ${file.name} -> ${destPath}`);
    await file.download({ destination: destPath });
  }

  console.log("✅ All assets downloaded successfully!");
}

downloadAllAssets().catch((err) => {
  console.error("❌ Failed to download assets:", err);
  process.exit(1);
});
