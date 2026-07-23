// src/components/Seo.tsx
import { useEffect } from "react";

const SITE_URL = "https://duumini.com";
const DEFAULT_IMAGE = `${SITE_URL}/hero-stats.webp`;

function setMetaByName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setMetaByProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Titre/description/OG par page — le SPA n'a qu'un seul index.html,
 * donc chaque route doit pousser ses propres balises au montage pour
 * ne pas garder le titre générique de la page précédente.
 */
export function Seo({
  title,
  description,
  image,
  path,
}: {
  title: string;
  description: string;
  image?: string;
  path?: string;
}) {
  useEffect(() => {
    const fullTitle = `${title} | Duumini`;
    document.title = fullTitle;

    setMetaByName("description", description);
    setMetaByProperty("og:title", fullTitle);
    setMetaByProperty("og:description", description);
    setMetaByName("twitter:title", fullTitle);
    setMetaByName("twitter:description", description);

    const finalImage = image || DEFAULT_IMAGE;
    setMetaByProperty("og:image", finalImage);
    setMetaByName("twitter:image", finalImage);

    const url = `${SITE_URL}${path ?? window.location.pathname}`;
    setCanonical(url);
    setMetaByProperty("og:url", url);
  }, [title, description, image, path]);

  return null;
}
