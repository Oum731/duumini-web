// src/pages/products/productForm/ImagePicker.tsx
import { useEffect, useMemo, useState } from "react";
import { imgUrl } from "../../../utils/media";
import type { ProductImage } from "./types";

export default function ImagePicker({
  files,
  setFiles,
  replaceImages,
  setReplaceImages,
  existingImages,
}: {
  files: File[];
  setFiles: (files: File[]) => void;
  replaceImages: boolean;
  setReplaceImages: (v: boolean) => void;
  existingImages?: ProductImage[];
}) {
  const [galleryInput, setGalleryInput] = useState<HTMLInputElement | null>(null);
  const [cameraInput, setCameraInput] = useState<HTMLInputElement | null>(null);

  const hasExistingImages = Array.isArray(existingImages) && existingImages.length > 0;

  function addFiles(list: FileList | null) {
    if (!list || !list.length) return;
    const current = [...files];
    for (const f of Array.from(list)) {
      if (current.length >= 8) break;
      current.push(f);
    }
    setFiles(current.slice(0, 8));
  }

  function removeAt(i: number) {
    const arr = [...files];
    arr.splice(i, 1);
    setFiles(arr);
  }

  const previews = useMemo(() => files.map((f) => ({ f, url: URL.createObjectURL(f) })), [files]);

  useEffect(() => {
    return () => {
      for (const p of previews) URL.revokeObjectURL(p.url);
    };
  }, [previews]);

  return (
    <div className="col-12 col-md-4">
      <label className="form-label d-flex align-items-center justify-content-between">
        Images <small className="text-muted">Galerie / Caméra</small>
      </label>

      {hasExistingImages && !files.length && !replaceImages ? (
        <div className="mb-2">
          <div className="small text-muted mb-1">Images existantes :</div>
          <div className="row g-2">
            {existingImages!.map((img) => (
              <div className="col-4" key={img.id}>
                <img
                  src={imgUrl(img.url)}
                  alt="existing"
                  className="w-100 rounded border"
                  style={{ aspectRatio: "1 / 1", objectFit: "cover" }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="d-flex flex-wrap gap-2 mb-2">
        <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => galleryInput?.click()}>
          Depuis la galerie
        </button>
        <button type="button" className="btn btn-dark btn-sm" onClick={() => cameraInput?.click()}>
          Ouvrir la caméra
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setFiles([])}
          disabled={!files.length}
        >
          Vider
        </button>
      </div>

      <input
        ref={(el) => setGalleryInput(el)}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(ev) => addFiles(ev.target.files)}
      />
      <input
        ref={(el) => setCameraInput(el)}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(ev) => addFiles(ev.target.files)}
      />

      <div className="form-check mb-2">
        <input
          id="replace_images"
          className="form-check-input"
          type="checkbox"
          checked={replaceImages}
          onChange={(ev) => setReplaceImages(ev.target.checked)}
        />
        <label htmlFor="replace_images" className="form-check-label">
          Remplacer la galerie existante
        </label>
      </div>

      {files.length > 0 ? (
        <div className="row g-2">
          {previews.map((p, i) => (
            <div className="col-4" key={i}>
              <div className="position-relative border rounded overflow-hidden">
                <img
                  src={p.url}
                  alt={`img-${i}`}
                  className="w-100"
                  style={{ aspectRatio: "1 / 1", objectFit: "cover" }}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-danger position-absolute"
                  style={{ top: 6, right: 6 }}
                  onClick={() => removeAt(i)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : !hasExistingImages ? (
        <div className="text-muted small">Aucune image sélectionnée.</div>
      ) : null}
    </div>
  );
}
