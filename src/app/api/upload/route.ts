import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("images") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }

    if (files.length > 8) {
      return NextResponse.json(
        { error: "Maximum 8 images allowed" },
        { status: 400 }
      );
    }

    // Get ImgBB API key from database
    const setting = await db.siteSetting.findUnique({
      where: { key: "imgbb_api_key" },
    });

    if (!setting || !setting.value) {
      return NextResponse.json(
        { error: "ImgBB API key not configured" },
        { status: 500 }
      );
    }

    const imgbbKey = setting.value;
    const urls: string[] = [];
    const uploadResults = [];

    for (const file of files) {
      // Validate file type
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!validTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF` },
          { status: 400 }
        );
      }

      // Validate file size (32MB max)
      if (file.size > 32 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File too large: ${file.name}. Maximum size is 32MB` },
          { status: 500 }
        );
      }

      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");

      const imgbbForm = new FormData();
      imgbbForm.append("key", imgbbKey);
      imgbbForm.append("image", base64);

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${imgbbKey}&expiration=600`,
        {
          method: "POST",
          body: imgbbForm,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("ImgBB upload error:", errorText);
        return NextResponse.json(
          { error: `Failed to upload ${file.name} to ImgBB` },
          { status: 500 }
        );
      }

      const data = await response.json();
      const url = data.data.url;
      urls.push(url);
      uploadResults.push({
        url,
        delete_url: data.data.delete_url,
      });
    }

    return NextResponse.json({
      success: true,
      data: { urls },
      images: uploadResults,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
